// ═══════════════════════════════════════════════════════════════
// photo-inbox.js — Photo Inbox ("Lazy Mode" Phase 1) — v0.9.879
//
// SELF-CONTAINED & REMOVABLE (same rule as show-mode.js):
//   • The feature is this file plus its pieces, photo-inbox-*.js
//     (2026-10-20 split, PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md; so far
//     photo-inbox-reader.js, the on-device number reader; photo-inbox-review.js,
//     the review card; photo-inbox-tools.js, the tools; photo-inbox-grid.js,
//     the grid; photo-inbox-identify.js, Identify my items, Google Photos,
//     the badges, the Dashboard card and Quick Capture;
//     photo-inbox-offline.js, offline staging, show-mode filing and upload).
//     To remove it, delete
//     their <script> tags from index.html (they sit together), remove the
//     sw.js precache lines, and bump versions. The pieces meet only through
//     window._pinShared (PIN, shared state) and window._pinFns (PINF, the
//     hand-over) — both made below.
//   • Storage: one Drive folder "Photo Inbox" inside the app's vault
//     folder (existing Drive scope — no new Google permissions).
//   • Touches other modules only by CALLING public entry points
//     (driveEnsureSetup, driveFindOrCreateFolder, driveUploadFile,
//      driveMoveFileToFolder, driveEnsureItemFolder, driveRequest,
//      loadDriveThumb, showPage, showToast, openWizard, sheetsUpdate,
//      personalColLetter, baseItemNum) and by injecting its sidebar
//     button after buildDashboard (show-mode's pattern).
//
// Phase 1 (this file): desktop inbox page — drag-drop / browse import,
//   grouped tiles (group tag in filename, ready for phone Quick
//   Capture's "multiple per item + Next Item" mode), multi-select,
//   triage: Assign to item number… (moves photos into the item's
//   Drive folder, repairs/sets the sheet's photo link, offers the Add
//   wizard for numbers not in the collection yet) and Discard (Drive
//   trash — recoverable for 30 days).
// Phase 2 (later): phone Quick Capture. Phase 3: batch AI identify.
//
// FILENAME CONVENTION (the grouping contract with Phase 2):
//   "INBOX <uploadTs> g<groupId> <original name>"
//   Tiles with the same g<groupId> render as ONE stack and triage
//   as one item. Desktop drops get one group per file.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';
  // ══ Photo Inbox split, step 2 (2026-10-20) — THE shared state ═════════════
  // The values that more than one part of the Photo Inbox CHANGES live on ONE
  // object, PIN, so that once the file is in pieces
  // (PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md) every piece reads and writes the
  // same value. Each is still first set where it always was ("PIN._sel = {}"
  // and so on), with its comment. A value only ONE part changes stays a plain
  // variable in that part.
  //   _sel _sessionEra _pinSession _thumbLink _groups _pinHaveListing _pinWatchSig
  //   _selPurpose _selectMode _tagEra _tagType _pinOneShot _rvOrderKeys _rvStayOn
  //   _rvKey _rvGroups _rvAiMfr _rvAiRec _idAbort
  // Step 4 added three the review card READS while this file changes them:
  //   _busy _pinLensGroups _rvPickedId
  // tests/pin_state_tests.js fails if one of these is used bare again.
  var PIN = window._pinShared = {};
  // ══ Photo Inbox split, step 3 (2026-10-20) — THE hand-over between pieces ══
  // A function one piece calls in another is handed over on ONE object,
  // PINF (window._pinFns): each piece hands over, at its top, the functions
  // the others call, and names there too what it takes from the others —
  // as stand-ins that call through PINF when they are used. Every such call
  // happens after the page has loaded (on a click, a timer, a read), never
  // while the pieces are still loading. tests/pin_handover_tests.js checks
  // that every name taken is handed over by some piece, and nothing extra.
  var PINF = window._pinFns = {};
  PINF.from = function (name) { return function () { return PINF[name].apply(this, arguments); }; };
  // From app/photo-inbox-reader.js (the on-device number reader):
  var _numberFromText = PINF.from('_numberFromText');
  var _freeReadBlob = PINF.from('_freeReadBlob');
  var _tessGet = PINF.from('_tessGet');
  var _prefEras = PINF.from('_prefEras');
  var _pinIsSetRow = PINF.from('_pinIsSetRow');
  var _pinQuoteMatch = PINF.from('_pinQuoteMatch');
  var _pinDescMatch = PINF.from('_pinDescMatch');
  var _pinReconcileAiNum = PINF.from('_pinReconcileAiNum');
  var _pinAiHints = PINF.from('_pinAiHints');
  // From app/photo-inbox-review.js (the review card):
  var _pinRowFromWords = PINF.from('_pinRowFromWords');
  var _pinKinPanelHtml = PINF.from('_pinKinPanelHtml');
  var _pinAiLine = PINF.from('_pinAiLine');
  var _pinRvNavRefresh = PINF.from('_pinRvNavRefresh');
  // From app/photo-inbox-tools.js (the Photo Inbox tools):
  var _ids = PINF.from('_ids');
  var _pendList = PINF.from('_pendList');
  var _idsSave = PINF.from('_idsSave');
  var _cropped = PINF.from('_cropped');
  var _croppedSave = PINF.from('_croppedSave');
  var _flushPending = PINF.from('_flushPending');
  var _repairMissingPhotoLinks = PINF.from('_repairMissingPhotoLinks');
  var _backfillMasterKeys = PINF.from('_backfillMasterKeys');
  var _backfillMasterRowIds = PINF.from('_backfillMasterRowIds');
  // From app/photo-inbox-grid.js (the Photo Inbox grid):
  var _pinOffline = PINF.from('_pinOffline');
  var _render = PINF.from('_render');
  var _pinNoteFileMap = PINF.from('_pinNoteFileMap');
  var _pinConfirm = PINF.from('_pinConfirm');
  var _pinOpaqueTint = PINF.from('_pinOpaqueTint');
  var _selGroups = PINF.from('_selGroups');
  var _pinOfflineRefuse = PINF.from('_pinOfflineRefuse');
  // From app/photo-inbox-identify.js (the Photo Inbox identify run, Google Photos, badges, Dashboard card and Quick Capture):
  var _qcToken = PINF.from('_qcToken');
  var _navBadge = PINF.from('_navBadge');
  var _pinPanelFill = PINF.from('_pinPanelFill');
  var _pinIdentifyRun = PINF.from('_pinIdentifyRun');
  var _pinGPStatus = PINF.from('_pinGPStatus');
  // From app/photo-inbox-offline.js (the Photo Inbox offline staging, show-mode filing and upload):
  var _upload = PINF.from('_upload');
  var _stageRenderStrip = PINF.from('_stageRenderStrip');
  var _stageDrain = PINF.from('_stageDrain');
  var _inboxCacheLoad = PINF.from('_inboxCacheLoad');
  var _inboxCacheSave = PINF.from('_inboxCacheSave');
  // Handed over to the other pieces (function declarations are hoisted, so
  // they exist already here, at the top):
  Object.assign(PINF, { _pinDemotedRow: _pinDemotedRow, _pinAiRowConflict: _pinAiRowConflict, _pinPreferOf: _pinPreferOf, _pinVisibleGroups: _pinVisibleGroups, _pinOnScreenFid: _pinOnScreenFid, _pinIsMultiPiece: _pinIsMultiPiece, _pinGroupNums: _pinGroupNums, _pinSetGuess: _pinSetGuess, _pinKindLabel: _pinKindLabel, _pinWatchSoon: _pinWatchSoon, _pinMetaSet: _pinMetaSet, _pinKind: _pinKind, _pinBusyBounce: _pinBusyBounce, _pinReadFile: _pinReadFile, _pinRecFor: _pinRecFor, _pinReadFid: _pinReadFid, _pinFilesToRead: _pinFilesToRead, _pinAr: _pinAr, _tokLine: _tokLine, _pinTagLineHtml: _pinTagLineHtml, _pinDemoteAdd: _pinDemoteAdd, _pinRvMarkCurrent: _pinRvMarkCurrent, _pinWhyHtml: _pinWhyHtml, _rvPrefer: _rvPrefer, _pinSheetCardCss: _pinSheetCardCss, _pinBtnBusy: _pinBtnBusy, _tokSave: _tokSave, _pinBytes: _pinBytes, _pinStepsReset: _pinStepsReset, _pinStep: _pinStep, _pinLookup: _pinLookup, _setBusy: _setBusy, _folder: _folder, _status: _status, _pinIsPairRole: _pinIsPairRole, _pinMetaOf: _pinMetaOf, _pinBestMaster: _pinBestMaster, _pinMfrAgree: _pinMfrAgree, _pinGroupingFor: _pinGroupingFor, _pinDashedKin: _pinDashedKin, _pinDefaultRoles: _pinDefaultRoles, _pinCarryRole: _pinCarryRole, _pinGroupCaption: _pinGroupCaption, _pinEraLabel: _pinEraLabel, _pinCoverFid: _pinCoverFid, _pinRenderFilters: _pinRenderFilters, _pinFilterActive: _pinFilterActive, _pinRenderBar: _pinRenderBar, _updateIdentifyBtn: _updateIdentifyBtn, _pinMetaSetMany: _pinMetaSetMany, _pinEtaText: _pinEtaText, _pinReadFiles: _pinReadFiles, _pinActiveEra: _pinActiveEra, _pinSetHomeEra: _pinSetHomeEra, _pinHomeEra: _pinHomeEra });
  // v0.9.1927 (Brad): "move the autoread button to beta testers only". Every
  // paid read in this file asks this ONE question (ai-id.js rrAutoReadOn — the
  // Vault features row 'auto_read'). The free reader is untouched.
  function _pinAr() { return (typeof rrAutoReadOn === 'function') && !!rrAutoReadOn(); }

  // ══ v0.9.1178 — the bottom-sheet chrome, written once ═════════════════════
  // Three sheets in this file (Group as…, the era picker, and the new where-from
  // picker) had the same backdrop typed out three times. Declared up here, not
  // beside the first user, because `var` hoists the NAME and not the VALUE — a
  // constant defined halfway down the file is `undefined` to everything above
  // it, which is a bug this file has already shipped twice.
  var _PIN_SHEET_OV = 'position:fixed;inset:0;z-index:10050;background:var(--scrim);'
    + 'display:flex;align-items:flex-end;justify-content:center';
  function _pinSheetCardCss(maxW, vh) {
    return 'background:var(--surface);border:1px solid var(--border);'
      + 'border-top-left-radius:16px;border-top-right-radius:16px;width:100%;'
      + 'max-width:' + (maxW || 520) + 'px;padding:1rem 1rem 1.2rem;'
      + 'max-height:' + (vh || 82) + 'vh;max-height:' + (vh || 82) + 'dvh;overflow-y:auto';
  }

  var FID_KEY = 'rr_inbox_fid';
  var PENDING_KEY = 'rr_inbox_pending';   // { itemNum: folderLink } waiting for wizard save
  var SETSTAGE_KEY = 'rr_inbox_setstage'; // v0.9.1122: set-add notes NOT yet armed (see _pinAddSetFromGroup)
  var CROPPED_KEY = 'rr_inbox_cropped';   // v0.9.961: { fileId: 1 } cropped -> load real bytes, not Drive's stale preview
  var _fid = null, _fidChecked = false;
  PIN._groups = [];          // [{ key, files:[{id,name,createdTime}] }]
  PIN._pinHaveListing = false; // v0.9.1871: a listing (online, or the saved one offline) has come back this session — only then is an empty _groups a KNOWN-empty inbox
  PIN._sel = {};             // groupKey -> true
  PIN._thumbLink = {};       // v0.9.1326: fileId -> thumbnailLink, from the listing
  PIN._selectMode = false;   // true while EITHER selection mode is running
  // v0.9.1057 (Brad): "Select multiple" said nothing about what it was for, so
  // the two things people actually do — put photos together, and say what they
  // are — had no front door. Two named buttons now, one selection mechanic.
  PIN._rvKey = '';           // group key the review card is open on ('' = multi-select)
  PIN._rvStayOn = '';        // v0.9.1960: the photo the card stays on when it repaints itself (a slot drop, a discard)
  // v0.9.1307 (Brad: "i selected a filter for not scanned, and there is no
  // next or previous arrows"): the arrows walked the LIVE filtered list, so
  // the moment a card was read it fell out of a not-read filter, its index
  // came back -1, and the arrows vanished — on exactly the workflow the
  // filter exists for. The walking order is now SNAPSHOTTED when the card
  // opens (group keys — stable identifiers) and released when it closes.
  PIN._rvOrderKeys = null;
  PIN._selPurpose = '';      // '' | 'group' | 'tag'  — what Apply does
  PIN._tagEra = '';          // era picked in tag mode, written on Apply
  PIN._tagType = '';         // v0.9.1297: item type picked in tag mode ('' = leave as-is)
  // The Type choices the tag bar offers. 'Paper' and 'Catalog' matter most —
  // they stop a blueprint being searched as a locomotive.
  var _PIN_TYPES = ['Engine', 'Tender', 'Boxcar', 'Flatcar', 'Gondola', 'Tank Car', 'Hopper',
                    'Caboose', 'Passenger Car', 'Accessory', 'Building', 'Track', 'Set',
                    'Paper', 'Catalog', 'Other'];
  // A shooting session. The context bar used to sit on the page permanently;
  // Brad only wants it while he is actually shooting. It appears when a session
  // starts, and Done ends it. Deliberately NOT persisted: a stale "Lionel
  // Postwar" left armed a week later is how forty cars get mis-stamped.
  PIN._pinSession = false;
  PIN._sessionEra = '';      // the session's home era (memory only)
  PIN._busy = false;

  // ── v0.9.1418 (Cooper, on a desktop: "I clicked apply button, nothing
  // happened") ──────────────────────────────────────────────────────────
  // He clicked Apply eight times in 36 seconds and the app never said a
  // word. It was working exactly as written: _pinApplyTags has three early
  // exits, two of which explain themselves and one — the busy guard — which
  // was a bare `return`. His breadcrumbs prove it was that one, because the
  // button read "Apply to 20" and that label is only built when photos are
  // ticked AND an era is chosen, which is precisely the pair of conditions
  // the two talking exits check.
  //
  // Underneath sits the real problem: ONE flag guards seven different
  // operations, and it was raised and lowered in fourteen scattered places
  // with no record of when, by what, or whether anything was still moving.
  // Every writer has a `finally`, so a THROW cannot strand it — but an
  // `await` that never settles never reaches the finally at all, and then
  // every batch button in the Photo Inbox is dead until a reload nobody
  // knows to do. (Cooper's trail has a 19-minute gap with no clicks, which
  // is what a sleeping machine with a request in flight looks like.)
  //
  // So the flag gets one owner and a memory. _setBusy is the only thing that
  // moves it; _busyProgressAt is stamped by _status(), which every long
  // operation already calls as it advances, so "is anything still moving?"
  // is answerable without teaching seven operations a new trick.
  var _busySince = 0;        // when the current job raised the flag
  var _busyWhat = '';        // plain-English name of that job, for the user
  var _busyProgressAt = 0;   // last time it reported progress (see _status)
  var _STUCK_MS = 120000;    // no progress for two minutes = wedged, not slow

  function _setBusy(on, what) {
    PIN._busy = !!on;
    if (on) {
      _busySince = _busyProgressAt = Date.now();
      _busyWhat = what || '';
    } else {
      _busySince = _busyProgressAt = 0;
      _busyWhat = '';
    }
  }
  function _busyStuck() {
    return PIN._busy && !!_busyProgressAt && (Date.now() - _busyProgressAt) > _STUCK_MS;
  }
  // The only safe way out. Clearing the flag under a live operation could let
  // a second run start beside the first — for filing to the collection that
  // means duplicate rows, which is a worse bug than the one being escaped.
  // A reload cannot double-write anything, and the inbox lives in Drive, so
  // nothing is lost. One tap instead of knowing to press F5.
  window._pinRestartApp = function () { location.reload(); };
  // Paints the wedged line. Returns true when it painted, so the caller can
  // stop rather than also scolding the collector about a batch.
  function _pinStuckStatus() {
    if (!_busyStuck()) return false;
    var el = document.getElementById('pin-status');
    if (!el) return true;
    var mins = Math.max(2, Math.round((Date.now() - _busyProgressAt) / 60000));
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '0.45rem';
    el.style.color = 'var(--danger)';
    el.style.fontWeight = '700';
    el.innerHTML =
      '<span>' + (_busyWhat ? rrEsc(_busyWhat) : 'Something') + ' has been stuck for ' + mins +
      ' minutes and nothing is saving. Restarting is safe — your photos are in Drive. </span>' +
      '<button type="button" onclick="_pinRestartApp()" style="border:none;background:var(--danger);color:var(--on-accent);' +
      'border-radius:6px;font-size:0.78rem;font-weight:700;padding:0.25rem 0.7rem;cursor:pointer;' +
      'font-family:var(--font-body);flex:none">Restart the app</button>';
    return true;
  }

  // ── Drive folder ─────────────────────────────────────────────
  async function _folder() {
    if (_fid && _fidChecked) return _fid;
    var cached = localStorage.getItem(FID_KEY);
    if (cached) {
      // v0.9.1606: offline, the check below cannot run — and the old code
      // treated an unreachable Drive as a MISSING folder and deleted the
      // cached id, so a device that spent a day at a show came home having
      // forgotten where its inbox lives. Offline, trust the cached id.
      if (_pinOffline()) { _fid = cached; return _fid; }   // not marked checked: verify when back on
      try {
        var chk = await driveRequest('GET', '/files/' + cached + '?fields=id,trashed');
        if (chk && chk.id && !chk.trashed) { _fid = cached; _fidChecked = true; return _fid; }
      } catch (e) {
        // v0.9.1606: only a real answer from Drive may retire the cached id.
        if (_pinOffline()) { _fid = cached; return _fid; }
      }
      localStorage.removeItem(FID_KEY);
    }
    await driveEnsureSetup();
    _fid = await driveFindOrCreateFolder('Photo Inbox', driveCache.vaultId);
    localStorage.setItem(FID_KEY, _fid);
    _fidChecked = true;
    return _fid;
  }

  // ── Page skeleton ────────────────────────────────────────────
  function _ensurePage() {
    if (document.getElementById('page-photo-inbox')) return true;
    var anyPage = document.getElementById('page-dashboard');
    if (!anyPage || !anyPage.parentNode) return false;
    var pg = document.createElement('div');
    pg.className = 'page';
    pg.id = 'page-photo-inbox';
    pg.innerHTML =
      // ══ v0.9.1342 — the header stays; only the photographs move ══════════
      // Brad: "the scroll should only scroll the pictures and leave the header
      // viewable the whole time. I don't like the layout of the header,
      // filters and help text we got going."
      //
      // Both complaints had one cause: ~250px of title, instructions, eight
      // filter chips and seven buttons, all in the normal flow, so the moment
      // he started working every control he needed was somewhere above the
      // screen. Now one sticky bar carries the controls, the instructions fold
      // away once read, and the filters are a single menu that NAMES what is
      // active instead of eight chips competing for the eye.
      //
      // Sticky rather than a fixed-height flex column on purpose: .main is
      // already the scroll container (overflow-y:auto), so sticky needs no
      // height arithmetic, survives every screen size, and cannot strand the
      // grid at 0px the way a mis-measured flex child can. The negative margin
      // and matching padding swallow .main's own 1.5rem so photographs do not
      // show through the gap above the bar when it is stuck.
      //
      // top is -1.5rem, NOT 0, and the rendering test is what caught it: a
      // sticky offset is measured from the scrollport's PADDING box, so
      // top:0 pinned the bar 1.5rem below the top of .main and photographs
      // scrolled visibly through the strip above it. The negative offset
      // pins the border-box edges together; the bar's own padding-top keeps
      // its contents exactly where they were.
      '<div id="pin-chrome" style="position:sticky;top:-1.5rem;z-index:5;background:var(--bg);' +
           'margin:-1.5rem -1.5rem 0;padding:1.5rem 1.5rem 0.55rem;box-shadow:0 6px 10px -8px rgba(0,0,0,0.25)">' +
        '<div class="page-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.45rem">' +
          '<span>Photo Inbox <span id="pin-count" style="font-size:0.8rem;color:var(--text-dim);font-family:var(--font-body);font-weight:400"></span></span>' +
          '<button id="pin-help-btn" onclick="_pinToggleHelp()" style="padding:0.3rem 0.6rem;border-radius:8px;border:none;background:none;color:var(--text-mid);font-family:var(--font-body);font-size:0.78rem;font-weight:600;cursor:pointer">? How this works</button>' +
        '</div>' +
        // The instructions. Shown in full the FIRST time someone opens this
        // page — a tester who has never seen it needs them, and Brad does not
        // — then folded away and remembered per device.
        '<div id="pin-help-text" style="display:none;font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.6rem">' + (window.IS_MOBILE_UA ? 'Use <b>Add photos</b> to take pictures or pick them from your phone.' : 'Drop photos anywhere below, or use Add photos.') + ' Get them ready at your own pace \u2014 crop, use \u201cGroup photos\u201d to put several shots of one item together, and \u201cTag maker/era/scale/type\u201d to say what photos are \u2014 then hit <b>Identify my items</b> to read them all. Photos you have tagged <b>Paper</b>, <b>Catalog</b> or <b>Other</b> are left out of that batch \u2014 there is rarely an item number to find on a drawing or a catalogue page' + (_pinAr() ? ', and on the paid read it would spend a photo ID for nothing' : '') + '. You can always tick any single photo and press Identify to read it anyway. ' + (window.IS_MOBILE_UA ? 'Tap' : 'Click') + ' a photo to review it \u2014 add the item, research it more, or discard the photo. ' + (window.IS_MOBILE_UA ? 'Photos you take with Quick Capture land here too.' : 'Photos snapped with Quick Capture on your phone land here too.') + '</div>' +
        '<div id="pin-context-bar" style="display:none"></div>' +   // v0.9.1048 capture context
        '<div id="pin-tagbar" style="display:none"></div>' +        // v0.9.1057 tag mode
        '<div id="pin-toolbar" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center">' +
          // Identify is what this page is FOR, so it is the one solid button
          // (v0.9.1340, Brad: "don't like the yellow color on the photo reader
          // buttons"). Add photos steps back to an outline beside it.
          '<button id="pin-identify-btn" class="btn-primary" onclick="_pinIdentifyItems()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Identify my items</button>' +
          '<button id="pin-add-photos" onclick="_pinAddSource()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Add photos\u2026</button>' +
          '<button id="pin-group-btn" onclick="_pinStartMode(\'group\')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Group photos</button>' +
          '<button id="pin-tag-btn" onclick="_pinStartMode(\'tag\')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Tag maker/era/scale/type</button>' +
          // The filter menu renders in here — one control that NAMES what is
          // active, in place of eight chips (v0.9.1051) that did not fit.
          '<span id="pin-filter-row" style="display:none"></span>' +
          '<button id="pin-apply-btn" onclick="_pinApplyTags()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Apply</button>' +
          '<button id="pin-finish-btn" onclick="_pinFinishMode()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">\u2713 Finished</button>' +
          '<button id="pin-selall-btn" onclick="_pinSelectAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Select all</button>' +
          // v0.9.1297 (Brad): reads run when HE says so \u2014 crop, tag and group
          // first, then this button. v0.9.1340 moved the paid read onto the
          // standard outline so free and paid never look alike at a glance.
          // v0.9.1411 (Brad, mobile): on a phone this paid read moves into the
          // "\u22ef More" menu so the toolbar fits two rows and the photos show.
          // On desktop #pin-overflow is display:contents, so the button flows
          // into the row exactly as before and #pin-more-btn stays hidden \u2014
          // nothing about the desktop layout changes.
          '<button id="pin-more-btn" onclick="_pinToggleMore(event)" aria-haspopup="true" aria-expanded="false" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">\u22ef More</button>' +
          '<span id="pin-overflow">' +
          '<button id="pin-idall-btn" onclick="_pinIdentifyAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">\ud83d\udd0d Read the unread</button>' +
          '</span>' +
          '<span style="flex:1"></span>' +
          '<span id="pin-selinfo" style="font-size:0.78rem;color:var(--text-dim)"></span>' +
          '<button id="pin-idsel-btn" onclick="_pinIdentifySelected()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Read these</button>' +
          '<button id="pin-assign-btn" onclick="_pinReview(null)" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Combine \u2192 one item\u2026</button>' +
          '<button id="pin-discard-btn" onclick="_pinDiscard()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-red);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Discard</button>' +
          // v0.9.1352 (Brad): the Reader audit is gone, which left a \u22ef menu
          // holding one row. Refresh is now a plain button. FOUR status
          // messages tell the user to "hit Refresh" \u2014 a partial listing, a
          // failed discard, a failed filing, a failed load \u2014 so the control
          // they are being sent to should be visible, not one tap inside a menu.
          '<button id="pin-refresh-btn" onclick="_pinRefresh()" title="Re-read the inbox folder from Google Drive" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Refresh</button>' +
        '</div>' +
        '<div id="pin-skipnote" style="display:none;font-size:0.78rem;color:var(--text-dim);margin:0.5rem 0 0"></div>' +
        '<div id="pin-status" style="display:none;font-size:0.8rem;color:var(--text-dim);margin:0.5rem 0 0"></div>' +
      '</div>' +
      '<div id="pin-staged" style="display:none"></div>' +
      '<div id="pin-drop" style="min-height:50vh;border:2px dashed var(--border);border-radius:12px;padding:0.8rem;margin-top:0.8rem">' +
        // v0.9.1776: this inline minimum is LEFT ALONE on purpose. It is only
        // what shows in the instant before _pinApplyCols() sets the real
        // column count, and app.css's phone grouping mode (v0.9.1595) measures
        // itself against this 150px as "half the normal tile".
        '<div id="pin-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.6rem"></div>' +
        '<div id="pin-empty" style="display:none;text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:0.95rem;margin-bottom:0.3rem;font-weight:600">Inbox is empty</div><div style="font-size:0.8rem">' + (window.IS_MOBILE_UA ? 'Tap <b>Add photos</b> to take pictures or choose some from your phone.' : 'Drag photos here from any folder, or click Add photos.') + '</div></div>' +
      '</div>' +
      '<input type="file" id="pin-file-input" accept="image/*" multiple style="display:none">';
    anyPage.parentNode.appendChild(pg);
    _pinApplyHelpState(_pinHelpOpenState());
    var drop = pg.querySelector('#pin-drop');
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.borderColor = '#2980b9'; drop.style.background = 'rgba(41,128,185,0.06)'; });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.borderColor = 'var(--border)'; drop.style.background = 'none'; });
    });
    drop.addEventListener('drop', function (e) {
      // v0.9.1439 (Brad): "if you drag a picture, it makes a copy and puts it at
      // the front of the list." Nothing in the grid was draggable, so the
      // browser fell back to its default — dragging an <img> drags the picture
      // itself — and this zone did exactly what it is for: imported it as a NEW
      // photo, which landed first because it was newest. The user was
      // accidentally using the import feature on a photo already in the inbox.
      // A drag that began inside the app is never an import: see the dragstart
      // guard below, which stamps them.
      if (window._pinInternalDrag) { showToast('Use the copy button on a photo to duplicate it', 3000); return; }
      var files = Array.prototype.filter.call((e.dataTransfer || {}).files || [], function (f) { return /^image\//.test(f.type); });
      if (files.length) _upload(files);
      else showToast('No image files in that drop', 2500, true);
    });
    // Tiles cannot be dragged at all — the grid has no order to rearrange, so a
    // drag there has no meaning worth supporting. The flag is belt-and-braces
    // for any other internal drag (the review card's thumbs, which DO reorder).
    drop.addEventListener('dragstart', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('.pin-tile')) { e.preventDefault(); return; }
      window._pinInternalDrag = true;
    }, true);
    drop.addEventListener('dragend', function () { window._pinInternalDrag = false; }, true);
    pg.querySelector('#pin-file-input').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (files.length) _upload(files);
    });
    return true;
  }

  // v0.9.1135: `stopFn` added. _status() escapes its message — correctly, since
  // read text comes off a photo and must never be trusted as markup. But the
  // reader audit passed a Stop BUTTON through here as an HTML string, so the
  // user saw the literal tag printed in the status line and the audit, which
  // runs six read variants over every photo and can take an hour, had no way
  // to be cancelled. The escaping stays; the button is now built as a real
  // element alongside it, so nothing from a photo can smuggle in markup.
  function _status(msg, stopFn) {
    var el = document.getElementById('pin-status');
    // v0.9.1418: THE progress heartbeat. Every long operation in this file
    // already calls _status as it advances ("Tagging 7 of 20…", "Importing 3
    // of 12…"), so stamping here means the stuck detector learns nothing new
    // and asks nothing new of seven call sites. Stamped before the early
    // return, because a missing #pin-status element does not mean the job
    // stopped moving — it means the page was rebuilt underneath it.
    if (msg && PIN._busy) _busyProgressAt = Date.now();
    if (!el) return;
    if (msg) {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '0.45rem';
      el.style.color = 'var(--t-link)';        // bright blue = "working"
      el.style.fontWeight = '700';
      el.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite;font-size:1rem;line-height:1">↻</span>' +
        '<span>' + String(msg).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
      if (typeof stopFn === 'function') {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Stop';
        b.style.cssText = 'border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);'
          + 'border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;'
          + 'font-family:var(--font-body);flex:none';
        b.onclick = stopFn;
        el.appendChild(b);
      }
    } else {
      el.style.display = 'none';
    }
  }

  // v0.9.1871 — when the tour's samples go away (config.js rrSamplesOn) the inbox,
  // which is not on the page-builder list, draws itself again from its own listing;
  // and the tour card asks whether this inbox is known (or, before the listing has
  // landed, counted at start-up) to be empty — the samples' cue.
  if (typeof window !== 'undefined') {
    if (window.RR_SAMPLE_REDRAW) window.RR_SAMPLE_REDRAW['photo-inbox'] = function () { if (PIN._pinHaveListing) _render(); };
    window._pinKnownEmpty = function () {
      if (PIN._groups.length) return false;
      if (PIN._pinHaveListing) return true;
      try { return localStorage.getItem(COUNT_KEY) === '0'; } catch (e) { return false; }
    };
  }

  // ── Open the page ────────────────────────────────────────────
  window._pinGo = function (clickedEl) {
    if (!_ensurePage()) { showToast('App is still loading — try again in a moment', 2500, true); return; }
    showPage('photo-inbox', clickedEl || document.getElementById('nav-photo-inbox'));
    _pinRefresh();
  };

  // ── List + render ────────────────────────────────────────────
  // ══ v0.9.1051 — filters (Brad's idea 4) ══════════════════════════════════
  // Brad asked for sub-folders: sorted, unsorted, Lionel postwar, engines,
  // identified, best guess. Most of those are PROPERTIES, not places — one
  // photo is Lionel and postwar and an engine and identified all at once, so
  // filing it into a folder means picking which fact wins and losing the rest.
  // These are filters: a view over the same photos, instant, and free. (Real
  // Drive sub-folders would also be an API call per photo and painful to undo.)
  //
  // The filter he will actually live in is STATUS, because with two hundred
  // items off a wall the fast way through is not photo by photo — it is "show
  // me the forty it was confident about" and rubber-stamp them, then "show me
  // the ones it could not read" and do those properly.
  var _pinFilter = { status: '', era: '', kind: '' };

  function _pinStatusOf(f) {
    var m = (f && f._meta) || {};
    var sug = _ids()[f.id];
    if (m.stat === 'filed') return 'filed';
    if (m.num || (sug && sug.num && !sug.guess)) return 'read';
    if (sug && (sug.num || (sug.alts && sug.alts.length))) return 'guess';
    if (sug && sug.tried) return 'noread';
    if (m.era) return 'stamped';
    return 'new';
  }
  var _PIN_STATUS_LABELS = {
    new: 'Not touched yet', stamped: 'Stamped, not read', read: 'Number found',
    guess: 'Best guess only', noread: 'Could not read', filed: 'Filed',
  };

  // ══ v0.9.1061 — never read the "everything together" shot ═══════════════
  // Brad: "on grouped items, it doesn't need to read the set picture or the
  // engine+tender picture or the aa, ab, aba picture, just the individual
  // items."
  //
  // Right, and it is worse than wasted effort. A photo of three locomotives
  // side by side has three numbers in it; the reader picks one and attaches it
  // to the group, so a shot taken to show the set as a whole actively produces
  // a wrong answer. The individual shots are the ones with exactly one number.
  //
  // 'together' is a real role in the kind table (Both together / All three
  // together / The whole set), so this is simply "skip that role".
  // v0.9.1343: a pair shot has SEVERAL numbers in it, exactly like the whole-set
  // shot — reading it picks one and files it against the wrong thing. One
  // predicate, used by the reader and by the set walk, so the two can never
  // disagree about what a pair shot is.
  function _pinIsPairRole(role) { return String(role || '').indexOf('pair_') === 0; }
  if (typeof window !== 'undefined') window._pinIsPairRole = _pinIsPairRole;

  function _pinReadFiles(g) {
    if (!g || !g.files || !g.files.length) return [];
    var body = g.files.filter(function (f) {
      var m = (f && f._meta) || {};
      // v0.9.1296 (request #24): a 'detail' photo is more shots of the piece
      // ABOVE it — it is never read as a member of its own, for the same
      // reason 'together' is skipped: reading it would attach a number to a
      // photo that must not become an item.
      return m.role !== 'together' && m.role !== 'detail' && !_pinIsPairRole(m.role);
    });
    // A group of nothing BUT together shots still deserves an attempt rather
    // than becoming unreadable — fall back to everything.
    var out = body.length ? body : g.files.slice();
    // v0.9.1960 (Brad: "if not selected, use right side"): in a group of ONE
    // item, the photo placed in the Right Side box is the one that speaks for
    // it — read first by Identify, the fallback for every read button. A set's
    // members are different items and keep their shot order.
    var kind = (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || g.kind || 'single';
    if (!_PIN_MULTI_KIND[kind]) {
      for (var i = 1; i < out.length; i++) {
        if (((out[i] && out[i]._meta) || {}).view === 'RSV') { out = [out[i]].concat(out.slice(0, i), out.slice(i + 1)); break; }
      }
    }
    return out;
  }

  // ══ v0.9.1960 — a group of ONE item keeps its identification ═════════════
  // Brad: "if i group a set of pictures and 1 of them is id by the reader or by
  // the google lens, the group should keep that id". Each photo keeps its own
  // record (v0.9.1090) — but in a group of angles of ONE item, a photo with no
  // read of its own (or only a weaker one) shows the group's best: a number you
  // typed (after Google Photo ID) beats a confirmed read, which beats a best
  // guess; on a tie, the photo that leads the group (the Right Side) wins. A
  // set, an engine + tender or an A-B-A is several items, so each photo there
  // still speaks only for itself.
  function _pinRecRank(rec) {
    if (!rec || !rec.num) return 0;
    if (rec.userTyped) return 3;
    return rec.guess ? 1 : 2;
  }
  function _pinGroupOfFid(fid) {
    var lists = [PIN._rvGroups || [], PIN._groups || []];
    for (var l = 0; l < lists.length; l++) {
      for (var i = 0; i < lists[l].length; i++) {
        var g = lists[l][i];
        if (g && g.files && g.files.some(function (f) { return f && f.id === fid; })) return g;
      }
    }
    return null;
  }
  function _pinIsOneItemGroup(g) {
    if (!g || !g.files || g.files.length < 2) return false;
    var kind = (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || g.kind || 'single';
    return !_PIN_MULTI_KIND[kind];
  }
  // The record a photo SHOWS: its own, or — in a one-item group — the group's
  // best when that is stronger. { rec, from } — from is the photo it came from
  // when it was borrowed, '' when it is the photo's own.
  function _pinRecFor(fid) {
    var all = _ids(), own = (fid && all[fid]) || null;
    var g = _pinGroupOfFid(fid);
    if (!_pinIsOneItemGroup(g)) return { rec: own, from: '' };
    var best = null, bestFid = '';
    _pinReadFiles(g).concat(g.files).forEach(function (f) {
      var r = f && all[f.id];
      if (_pinRecRank(r) > _pinRecRank(best)) { best = r; bestFid = f.id; }
    });
    if (best && bestFid !== fid && _pinRecRank(best) > _pinRecRank(own)) return { rec: best, from: bestFid };
    return { rec: own, from: '' };
  }
  if (typeof window !== 'undefined') window._pinRecFor = _pinRecFor;
  // ══ v0.9.1090 — a set is SEVERAL items (Brad: "it got the engine in the
  // set, but i dont think it got the rest of the items"). His seven-photo
  // Burlington set: the 2328 engine was read because it happens to lead the
  // group; the Elizabeth, Clifton and Summit cars behind it never got a turn.
  // One-photo-per-group is right when the photos are ANGLES of one item
  // (engine alone, its box) and wrong when they are MEMBERS of a set, where
  // every photo has its own number.
  var _PIN_MULTI_KIND = { set: 1, aa: 1, ab: 1, aba: 1, tender: 1 };
  // ══ v0.9.1341 — the inbox already ANSWERED the grouping question ══════════
  // Brad tagged the stack "Engine + tender" or "ABA" before it ever reached the
  // wizard, and the wizard asked him again — the inbox knew and threw it away.
  // This is the whole map, stated once. 'paper' has its own route
  // (wizardChooseCategory), 'set' has its own flow (_pinAddSetFromGroup), and
  // 'box'/'single' have nothing to pre-answer.
  var _PIN_KIND_TO_GROUPING = { tender: 'engine_tender', aa: 'aa', ab: 'ab', aba: 'aba' };
  function _pinGroupingFor(kind) { return _PIN_KIND_TO_GROUPING[String(kind || '')] || ''; }
  if (typeof window !== 'undefined') window._pinGroupingFor = _pinGroupingFor;
  function _pinFilesToRead(g) {
    var files = _pinReadFiles(g);
    if (!files.length) return [];
    var kind = (files[0] && files[0]._meta && files[0]._meta.kind) || g.kind || 'single';
    return _PIN_MULTI_KIND[kind] ? files : [files[0]];
  }

  // ══ v0.9.1340 — a BATCH read does not spend itself on paperwork ══════════
  // Brad: "our reader shouldn't read anything that says paper, catalog,
  // other… now if the user selects it individually, they can try to scan it."
  //
  // He is right, and the cost is not only his time. The free run quoted him 24
  // minutes; the PAID run spends a real photo ID per item, and a photo ID spent
  // on a catalogue page is money gone. Worse than wasted either way: a reader
  // pointed at a blueprint dutifully finds the number in its title block and
  // files it as an item guess, so every one of those becomes a wrong "best
  // guess" he has to open and dismiss. His own inbox screenshot is full of
  // them — drawings captioned 2205?, 24147?, 5200?.
  //
  // Deliberately NOT skipped: Building, Track, Accessory and the car types.
  // Those ARE catalogue pieces with real numbers (a 132 Passenger Station, an
  // O22 switch) — skipping them would skip items, not paperwork. And Set stays
  // readable both ways (Brad, 08-05): a set BOX usually carries the set number,
  // and a Train set GROUP is several real pieces that each get read.
  //
  // This gates the two BATCH entry points only. Ticking a photo and pressing
  // Identify, or reading one from the review card, is a deliberate act and
  // always works — that is the override, and the help text says so.
  var _PIN_NO_BATCH_READ = { paper: 1, catalog: 1, other: 1 };
  function _pinSkipBatchRead(f) {
    var t = String((((f && f._meta) || {}).type) || '').trim().toLowerCase();
    return !!(t && _PIN_NO_BATCH_READ[t]);
  }
  // A group is skipped when the photo that WOULD be read is skippable.
  function _pinSkipBatchGroup(g) { return _pinSkipBatchRead(_pinReadFile(g)); }

  // ══ v0.9.1341 — the cover photo the panel has been PROMISING ═════════════
  // The Group photos panel has said "a set shot of everything together becomes
  // the group's cover photo" since v0.9.1050, and nothing implemented it: the
  // tile always showed files[0], so the together shot was the cover only if it
  // happened to be dragged to position one. A promise in copy is exactly the
  // kind of unverified claim this app strips out elsewhere — so rather than
  // delete the sentence, make it true. It is also the RIGHT picture: a shot of
  // the whole set is what identifies the stack at a glance, which is why the
  // sentence was written in the first place.
  //
  // Cover is for DISPLAY only. Which photo gets READ is _pinReadFile (which
  // deliberately excludes 'together'), and which becomes the Right Side View
  // on save is untouched — three different questions, three resolvers, no
  // borrowing between them.
  function _pinCoverFile(g) {
    if (!g || !g.files || !g.files.length) return null;
    for (var i = 0; i < g.files.length; i++) {
      var m = (g.files[i] && g.files[i]._meta) || {};
      if (m.role === 'together') return g.files[i];
    }
    return g.files[0];
  }
  function _pinCoverFid(g) { var f = _pinCoverFile(g); return f ? f.id : ''; }
  if (typeof window !== 'undefined') window._pinCoverFile = _pinCoverFile;

  // The one photo that represents this group for reading purposes.
  function _pinReadFile(g) { return _pinReadFiles(g)[0] || (g && g.files && g.files[0]) || null; }
  function _pinReadFid(g) { var f = _pinReadFile(g); return f ? f.id : ''; }

  // ══ v0.9.1176 — a stack of pieces is not "one item" ══════════════════════
  // Brad: "if we group an item by a set, don't list an item in the set as what
  // it is, if all the items are id, like this one, we should be able to
  // suggest a set."
  //
  // Two places let one member speak for the whole stack. The inbox tile put
  // the first readable photo's number in its caption, so a seven-photo
  // Burlington set was labelled 2328 — the engine standing in for the set it
  // came out of. And the review card header said "7 photos and one item" no
  // matter what, which is exactly backwards for a set.
  //
  // Neither is a cosmetic complaint. A stack labelled 2328 invites one tap on
  // Add, and one tap on Add files a single engine when six other pieces are
  // sitting in the same stack waiting to be entered.

  // Every distinct number known across a group's member photos, in the order
  // they were shot. Members only — the "everything together" shot has three
  // numbers in it and is never read (see _pinReadFiles).
  //
  // This asks what the stack KNOWS, not what the reader would be sent, which is
  // why it walks _pinReadFiles rather than _pinFilesToRead: a photo anywhere in
  // the stack can carry its own read from a re-scan or a paid read, and one of
  // those is still a number this stack knows about.
  //
  // confirmedOnly drops hedged reads. Used where a wrong answer would cost
  // something — see _pinIsMultiPiece.
  function _pinGroupNums(g, confirmedOnly) {
    var out = [];
    try {
      var ids = _ids();
      _pinReadFiles(g).forEach(function (f) {
        var s = f && ids[f.id];
        if (!s || !s.num) return;
        if (confirmedOnly && s.guess) return;
        var n = String(s.num).trim();
        if (n && out.indexOf(n) < 0) out.push(n);
      });
    } catch (e) {}
    return out;
  }

  // Is this stack several PIECES, or several angles of one thing?
  //
  // Two independent signals and either is enough. The kind Brad tagged it with
  // is the reliable one — Set, AA, AB, ABA and Engine + tender all mean more
  // than one inventory row. The second catches the untagged stack: two member
  // photos that read DIFFERENT numbers cannot both be the same item.
  //
  // "Item + its box" is deliberately excluded from the second signal. Those
  // two photos are one item by definition, so a box that reads its own code is
  // a misread, not a second piece, and calling it one would be a new wrong
  // answer in place of the old one.
  //
  // The second signal counts CONFIRMED reads only. Two hedged reads that
  // disagree are far more likely to be one item read badly twice than two
  // items, and this app has spent too many versions removing exactly that kind
  // of confident guess to add a fresh one here.
  function _pinIsMultiPiece(g) {
    if (!g || !g.files || g.files.length < 2) return false;
    var kind = (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || g.kind || 'single';
    if (_PIN_MULTI_KIND[kind]) return true;
    // v0.9.1279: 'paper' joins 'box' — a catalog's pages read all sorts of
    // stray numbers, and none of them make it several items.
    if (kind === 'box' || kind === 'paper') return false;
    return _pinGroupNums(g, true).length > 1;
  }

  // Ask the Sets catalog whether these numbers add up to a known set.
  //
  // Display only. Nothing here changes what gets saved or which wizard runs,
  // so a wrong guess costs a glance and not a bad row — which is why it is
  // allowed to guess at all.
  //
  // One shared number is a coincidence: a 6464 boxcar appears in dozens of
  // sets. Two is a claim worth making, and the line says how many matched so
  // the number can be judged rather than taken on trust.
  function _pinSetGuess(nums) {
    try {
      if (!nums || nums.length < 2) return null;
      if (typeof suggestSets !== 'function') return null;
      var sd = (window.state || {}).setData;
      if (!Array.isArray(sd) || !sd.length) return null;
      var hits = suggestSets(nums);
      var best = hits && hits[0];
      if (!best || !best.setNum || (best.primaryMatches || 0) < 2) return null;
      return {
        setNum:  String(best.setNum),
        setName: String(best.setName || ''),
        year:    String(best.year || ''),
        matched: best.primaryMatches || 0,
        of:      nums.length,
        pieces:  (best.items || []).length,
      };
    } catch (e) { return null; }
  }

  // What the stack should call itself, given that it is several pieces. Either
  // the set it appears to be, or an honest count of how far the reading got.
  function _pinGroupCaption(g) {
    var nums = _pinGroupNums(g);
    var guess = _pinSetGuess(nums);
    if (guess) return 'set ' + guess.setNum;
    var total = _pinReadFiles(g).length;
    return nums.length + ' of ' + total + ' read';
  }

  if (typeof window !== 'undefined') {
    window._pinInboxFolderId = _folder;   // v0.9.1499: gallery "send back to inbox" needs the folder
    window._pinGroupNums    = _pinGroupNums;
    window._pinIsMultiPiece = _pinIsMultiPiece;
    window._pinSetGuess     = _pinSetGuess;
    window._pinGroupCaption = _pinGroupCaption;
  }

  function _pinGroupPasses(g) {
    var f = _pinReadFile(g) || g.files[0], m = (f && f._meta) || {};
    if (_pinFilter.status && _pinStatusOf(f) !== _pinFilter.status) return false;
    if (_pinFilter.era && m.era !== _pinFilter.era) return false;
    if (_pinFilter.kind && (m.kind || 'single') !== _pinFilter.kind) return false;
    return true;
  }
  function _pinVisibleGroups() {
    if (!_pinFilter.status && !_pinFilter.era && !_pinFilter.kind) return PIN._groups;
    return PIN._groups.filter(_pinGroupPasses);
  }
  function _pinFilterActive() { return !!(_pinFilter.status || _pinFilter.era || _pinFilter.kind); }

  // Counts so a chip can say what is behind it before you tap.
  function _pinCounts() {
    var st = {}, era = {}, kind = {};
    PIN._groups.forEach(function (g) {
      var f = _pinReadFile(g) || g.files[0], m = (f && f._meta) || {};
      var s2 = _pinStatusOf(f); st[s2] = (st[s2] || 0) + 1;
      if (m.era) era[m.era] = (era[m.era] || 0) + 1;
      var k = m.kind || 'single'; kind[k] = (kind[k] || 0) + 1;
    });
    return { status: st, era: era, kind: kind };
  }

  window._pinSetFilter = function (which, val) {
    _pinFilter[which] = (_pinFilter[which] === val) ? '' : val;
    _render();
  };
  window._pinClearFilters = function () {
    _pinFilter = { status: '', era: '', kind: '' };
    _render();
  };
  if (typeof window !== 'undefined') {
    window._pinVisibleGroups = _pinVisibleGroups;
    window._pinStatusOf = _pinStatusOf;
    window._pinCounts = _pinCounts;
    window._pinFilterState = function () { return _pinFilter; };
  }

  function _pinRenderFilters() {
    var el = document.getElementById('pin-filter-row');
    if (!el) return;
    var c = _pinCounts();
    // ══ v0.9.1342 — ONE control instead of eight chips ═════════════════════
    // Brad: "i don't like the layout of the header, filters and help text."
    // Eight chips wrapped onto two rows and shouted equally; a menu costs one
    // click and NAMES what is active, which a row of chips never quite does.
    // _pinSetFilter and _pinClearFilters are untouched — this is a different
    // front door onto the same two functions, not a second filter mechanism.
    var opts = [];
    function opt(which, val, label, n) {
      if (!n) return;
      var on = _pinFilter[which] === val;
      opts.push('<option value="' + which + '|' + val + '"' + (on ? ' selected' : '') + '>'
        + rrEsc(label) + ' (' + n + ')</option>');
    }
    var groups = [];
    var before = 0;
    ['new','stamped','guess','read','noread','filed'].forEach(function (k) { opt('status', k, _PIN_STATUS_LABELS[k], c.status[k]); });
    if (opts.length > before) { groups.push('<optgroup label="How it read">' + opts.slice(before).join('') + '</optgroup>'); before = opts.length; }
    Object.keys(c.era).forEach(function (k) { opt('era', k, _pinEraLabel(k), c.era[k]); });
    if (opts.length > before) { groups.push('<optgroup label="Maker &amp; era">' + opts.slice(before).join('') + '</optgroup>'); before = opts.length; }
    Object.keys(c.kind).forEach(function (k) { if (k !== 'single') opt('kind', k, _pinKindLabel(k), c.kind[k]); });
    if (opts.length > before) { groups.push('<optgroup label="Groups">' + opts.slice(before).join('') + '</optgroup>'); before = opts.length; }
    if (!groups.length) { el.style.display = 'none'; return; }
    var active = _pinFilterActive();
    el.style.cssText = 'display:inline-flex;align-items:center;gap:0.3rem';
    el.innerHTML =
      '<select id="pin-filter-select" onchange="_pinFilterPick(this.value)" '
      + 'style="padding:0.45rem 0.6rem;border-radius:8px;border:1.5px solid ' + (active ? 'var(--accent)' : '#8b8e94') + ';'
      + 'background:var(--bg-card);color:' + (active ? 'var(--t-accent)' : 'var(--t-link)') + ';font-family:var(--font-body);'
      + 'font-size:0.82rem;font-weight:700;cursor:pointer;max-width:230px">'
      + '<option value="">' + (active ? 'Filter: change\u2026' : 'Filter: all photos') + '</option>'
      + groups.join('')
      + '</select>'
      + (active
          ? '<button onclick="_pinClearFilters()" title="Show all photos" style="padding:0.45rem 0.55rem;border-radius:8px;border:none;background:none;color:var(--text-dim);font-size:0.78rem;text-decoration:underline;cursor:pointer">Show all</button>'
          : '');
    el.style.display = 'inline-flex';
  }
  // The select hands back "which|value"; the existing resolver does the rest.
  window._pinFilterPick = function (v) {
    var i = String(v || '').indexOf('|');
    if (i < 0) return;
    _pinSetFilter(v.slice(0, i), v.slice(i + 1));
  };

  // ══ v0.9.1342 — the instructions fold away once read ═════════════════════
  // Shown in FULL the first time this page is ever opened on a device — a
  // tester who has never seen it needs them and Brad does not — then folded
  // and remembered. Deliberately per-device localStorage, not a sheet column:
  // it is a preference about a screen, and it must never fail an add.
  var _PIN_HELP_SEEN = 'rr_pin_help_seen';
  function _pinHelpOpenState() {
    try { return localStorage.getItem(_PIN_HELP_SEEN) !== '1'; } catch (e) { return true; }
  }
  function _pinApplyHelpState(open) {
    var t = document.getElementById('pin-help-text');
    var b = document.getElementById('pin-help-btn');
    if (t) t.style.display = open ? '' : 'none';
    if (b) b.textContent = open ? '\u00d7 Hide this' : '? How this works';
  }
  // v0.9.1871: the tour folds the instructions while its own card explains the page
  // (on a phone they fill half the screen and hide the photos the card is about) and
  // puts back the remembered state as it moves on. Display only — nothing remembered.
  window._pinHelpShow = function (open) { _pinApplyHelpState(open == null ? _pinHelpOpenState() : !!open); };
  window._pinToggleHelp = function () {
    var t = document.getElementById('pin-help-text');
    if (!t) return;
    var open = (t.style.display === 'none');
    _pinApplyHelpState(open);
    try { localStorage.setItem(_PIN_HELP_SEEN, '1'); } catch (e) {}
  };

  // ══ The overflow menu — rare-but-real actions, one click away ════════════

  // ══ v0.9.1050 — group kinds and roles ════════════════════════════════════
  // Photos already stack into groups (the g<id> tag). What a stack could not
  // say is WHAT it is — and that matters, because an ABA is not one item with
  // three photos, it is three inventory rows that share a group, and each unit
  // needs its role so it saves as -P, C or -D. Brad's flow is: shoot the
  // powered A, the B, the dummy A, then a fourth shot of the three together.
  //
  // Roles are per kind, and 'together' exists for that last shot — the one
  // that becomes the group's cover photo rather than an item of its own.
  var _PIN_KINDS = [
    { id:'single', label:'One item',            roles:[] },
    // v0.9.1279 (Brad): "add another button for paper/other collection." A
    // framed print shot from three angles is ONE collectible, not a set — and
    // marking it here is what routes the add straight into the paper flow.
    { id:'paper',  label:'Paper / other collectible', roles:[] },
    { id:'tender', label:'Engine + tender',     roles:[['engine','Engine'],['tender','Tender'],['together','Both together']] },
    { id:'aa',     label:'AA — two A units',    roles:[['p','A unit, powered'],['d','A unit, dummy'],['together','Both together']] },
    { id:'ab',     label:'AB — A and B',        roles:[['p','A unit, powered'],['b','B unit'],['together','Both together']] },
    { id:'aba',    label:'ABA — A, B, A',       roles:[['p','A unit, powered'],['b','B unit'],['d','A unit, dummy'],['together','All three together']] },
    // v0.9.1296 (request #24, Brad): "we need to have the pull down menu say
    // type of car… engine, tender, boxcar, flatcar, caboose" — and a car with
    // a detail close-up is ONE piece, not two. The role list is now the car
    // types, plus 'detail' which chains a photo to the piece ABOVE it (his
    // pick, 2026-08-03: one dropdown entry, matches shooting order). The old
    // 'member' id lives on as "Other piece" so every already-tagged photo
    // still resolves. dflt keeps the default sensible: every photo starts as
    // a piece, nothing is guessed as an engine.
    { id:'set',    label:'Train set',           dflt:'member',
      // v0.9.1448 (Brad): "engine should be steam engine, we also need to add
      // transformer, track, box, set box, accessory" — plus the three diesel
      // unit roles, so an AA/AB/ABA folded into a set keeps its identities.
      // 'engine' keeps its id (label-only rename) so old tags still resolve
      // and the pair-shots-file-with-the-engine rule keeps working.
      roles:[['engine','Steam Engine'],['tender','Tender'],
             ['aunit_p','A unit \u2014 powered'],['aunit_d','A unit \u2014 dummy'],['bunit','B unit'],
             ['boxcar','Boxcar'],['flatcar','Flatcar'],
             ['gondola','Gondola'],['tank','Tank Car'],['hopper','Hopper'],['caboose','Caboose'],
             ['passenger','Passenger Car'],
             ['transformer','Transformer'],['track','Track'],['accessory','Accessory'],
             ['box','Box'],['setbox','Set Box'],
             ['member','Other piece'],
             // v0.9.1343 (Brad): "still can't list the picture of the engine +
             // tender as engine+tender." A shot of a PAIR inside a set is not
             // a piece — the engine and the tender are their own members, each
             // with their own photo, and this picture shows both of them at
             // once. So it is a LABEL plus one behaviour (Brad's own call:
             // "can we just say that those 4 types are just labels and that
             // that picture goes under the engine and tender group as a detail
             // photo"): never read, never its own item, filed with the set's
             // ENGINE wherever it sits in the order. No new save machinery,
             // and no rows appear that the user did not photograph.
             ['pair_tender','Engine + tender — both in one shot'],
             ['pair_aa','AA — both units in one shot'],
             ['pair_ab','AB — both units in one shot'],
             ['pair_aba','ABA — all three in one shot'],
             ['detail','Detail — same piece as the photo above'],
             ['together','The whole set']] },   // v0.9.1279 (Brad): "change set to train set"
    { id:'box',    label:'Item + its box',      roles:[['item','The item'],['box','The box']] },
  ];
  function _pinKind(id) {
    for (var i = 0; i < _PIN_KINDS.length; i++) if (_PIN_KINDS[i].id === id) return _PIN_KINDS[i];
    return _PIN_KINDS[0];
  }
  function _pinKindLabel(id) { return _pinKind(id).label; }
  function _pinRoleLabel(kindId, roleId) {
    var rs = _pinKind(kindId).roles;
    for (var i = 0; i < rs.length; i++) if (rs[i][0] === roleId) return rs[i][1];
    return '';
  }
  // Sensible first guess: the order the photos were taken is usually the order
  // Brad shot them in — powered, B, dummy, together.
  function _pinDefaultRoles(kindId, n) {
    var rs = _pinKind(kindId).roles, out = [];
    if (!rs.length) return out;
    // v0.9.1296: a kind with a declared default (Train set) starts every
    // photo there — with eleven car types in the list, positional guessing
    // would call photo one an engine and photo two a tender every time.
    var _k = _pinKind(kindId);
    if (_k.dflt) {
      for (var j = 0; j < n; j++) out.push(_k.dflt);
      return out;
    }
    // 'together' is only a real possibility for kinds that HAVE one, and only
    // when there are more photos than units. A six-piece set shot one piece at
    // a time is six members and no group shot — guessing otherwise would
    // mislabel the last one every time.
    var hasTogether = rs.some(function (r) { return r[0] === 'together'; });
    var body = hasTogether ? rs.slice(0, -1) : rs;
    for (var i = 0; i < n; i++) {
      if (i < body.length) out.push(body[i][0]);
      else if (hasTogether && i === n - 1 && body.length > 1) out.push('together');
      else out.push(body[body.length - 1][0]);
    }
    return out;
  }
  // \u2500\u2500 v0.9.1448 (Brad): "i grouped the engines as aa pair and then i
  // grouped it in the set. So it should have brought them in as A powered,
  // A dummy." When an existing pair group folds into a Train set, each
  // photo's old role TRANSLATES into the set's vocabulary instead of
  // resetting to "Other piece". The dissolve warning still fires \u2014 this
  // only changes what the role dropdowns are pre-set to afterwards.
  var _PIN_CARRY = {
    aa:     { p:'aunit_p', d:'aunit_d', together:'pair_aa' },
    ab:     { p:'aunit_p', b:'bunit',   together:'pair_ab' },
    aba:    { p:'aunit_p', b:'bunit', d:'aunit_d', together:'pair_aba' },
    tender: { engine:'engine', tender:'tender', together:'pair_tender' }
  };
  function _pinCarryRole(f) {
    var m = (f && f._meta) || {};
    var map = _PIN_CARRY[String(m.kind || '')];
    return (map && map[String(m.role || '')]) || '';
  }
  if (typeof window !== 'undefined') {
    window._pinKinds = function () { return _PIN_KINDS; };
    window._pinDefaultRoles = _pinDefaultRoles;
    window._pinKindLabel = _pinKindLabel;
    window._pinCarryRole = _pinCarryRole;
  }
  // (→ app/photo-inbox-grid.js, split step 6: moved word for word.)

  // ══ RELEASE A CLAIMED PHOTO (v0.9.1782) ═══════════════════════════════════
  // [stated] Brad, two photos greyed out and badged "⏳ → 6050" / "⏳ → 6346"
  // eight days after he took them: "i am obviously online so why are these
  // here?"
  //
  // He was right to push back. The badge meant an add had spoken for those
  // photos and its save never finished; being online had nothing to do with
  // it, and the tooltip saying "offline saves finish when you reconnect"
  // pointed him at the one cause that was NOT his.
  //
  // Worse, there was no way out. The badge was read-only — no button, no menu
  // — so a photo claimed by an abandoned add stayed claimed with nothing the
  // user could do about it. THAT is the real defect; the expiry below is the
  // safety net, this is the door.
  //
  // SURGICAL BY DESIGN: a note can claim several photos and a number can have
  // several notes queued. Releasing ONE photo removes only that file from the
  // note that holds it, and drops the note only when nothing is left in it.
  // Releasing a photo must never quietly cancel the add that claimed it.
  window._pinReleaseClaim = async function (key) {
    var g = null;
    PIN._groups.forEach(function (x) { if (x.key === key) g = x; });
    if (!g || !g.files.length) return;
    var map = _pinNoteFileMap();
    var ids = g.files.map(function (f) { return f.id; }).filter(function (id) { return map[id]; });
    if (!ids.length) return;
    var who = map[ids[0]];
    var ok = await _pinConfirm(
      'Release ' + (ids.length > 1 ? ('these ' + ids.length + ' photos') : 'this photo') +
      ' from item <strong>' + rrEsc(String(who)) + '</strong>?<br><br>' +
      'The ' + (ids.length > 1 ? 'photos stay' : 'photo stays') +
      ' in the inbox — this only stops them waiting on an add that never finished. ' +
      'Nothing is deleted.', 'Release');
    if (!ok) return;
    var freed = _pinDropClaims(ids);
    showToast(freed ? ('Released — no longer waiting on ' + who) : 'Nothing was waiting on that photo', 3000, !freed);
    _render();
  };

  // Remove these file ids from every claim note in BOTH stores. Returns how
  // many files were actually freed. Shared with the expiry sweep so there is
  // one place that knows the shape of a note.
  function _pinDropClaims(ids) {
    var want = {}; (ids || []).forEach(function (i) { want[i] = 1; });
    var freed = 0;
    [SETSTAGE_KEY, PENDING_KEY].forEach(function (storeKey) {
      var store;
      try { store = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch (e) { return; }
      var dirty = false;
      Object.keys(store).forEach(function (num) {
        var notes = (typeof _pendList === 'function') ? _pendList(store[num]) : [store[num]];
        var kept = [];
        notes.forEach(function (rec) {
          if (!rec || typeof rec !== 'object' || !rec.files) { kept.push(rec); return; }
          var before = rec.files.length;
          rec.files = rec.files.filter(function (f) { return !(f && f.id && want[f.id]); });
          if (rec.files.length !== before) { freed += before - rec.files.length; dirty = true; }
          // A note with no photos left has nothing to move — drop it.
          if (rec.files.length) kept.push(rec);
        });
        if (!kept.length) { delete store[num]; dirty = true; }
        else store[num] = (kept.length === 1 && !Array.isArray(store[num])) ? kept[0] : kept;
      });
      if (dirty) { try { localStorage.setItem(storeKey, JSON.stringify(store)); } catch (e) {} }
    });
    return freed;
  }

  // Break a group back into loose photos.
  window._pinUngroup = async function (key) {
    var g = null;
    PIN._groups.forEach(function (x) { if (x.key === key) g = x; });
    if (!g || g.files.length < 2) return;
    // v0.9.1132: '-' not '' — see _pinMetaOf. An empty value is indistinguishable
    // from "never grouped", which is why this used to do nothing to a stack that
    // came from Quick Capture (those group by FILENAME, not by tag).
    var ok = await _pinMetaSetMany(g.files.map(function (f) { return f.id; }), { grp: '-', kind: 'single', role: '' });
    showToast(ok === g.files.length ? 'Split back into single photos' : ('Split ' + ok + ' of ' + g.files.length), 3000, ok !== g.files.length);
    _pinRefresh();
  };

  // ══ v0.9.1048 — capture context ══════════════════════════════════════════
  // Brad shoots a wall: forty Lionel Postwar cars in a row, then one modern
  // "Celebration Series" remake that is identical to the postwar version apart
  // from a plaque underneath. The reader cannot see the difference; only he
  // knows. So the photo needs to carry what he knows, from the moment he takes
  // it.
  //
  // Two settings, deliberately different:
  //   HOME     the shelf you are working — sticky, survives restarts.
  //   ONE-SHOT armed for the NEXT photo only, then springs back to home.
  // One-shot is the default when you change the bar, because "flip it, take
  // one, flip it back" is the real pattern and forgetting the flip back is the
  // failure that quietly mis-stamps the next forty cars.
  //
  // One era key carries maker, scale and period together, so the three
  // dropdowns narrow each other and cannot produce a combination that never
  // existed (there is no Lionel prewar HO).
  // v0.9.1276 (R11 leftovers): _PIN_HOME_KEY ('rr_capture_home_era') was
  // the localStorage home for the era before v0.9.1057 moved it to session
  // memory (Brad's call — a setting that outlives the shelf you were
  // photographing is a trap). The constant outlived its use by 200+
  // versions; devices from before the change may still hold the stale key,
  // so it is cleared once here rather than left forever.
  try { localStorage.removeItem('rr_capture_home_era'); } catch (eHK) {}
  PIN._pinOneShot = null;          // era key armed for the next photo only

  // v0.9.1057: the home era used to live in localStorage and survive restarts.
  // Brad's call: it clears when the session is done. A setting that outlives the
  // shelf you were photographing is a trap, not a convenience — you come back
  // next week, shoot MTH, and it all lands as Lionel Postwar.
  function _pinHomeEra() { return PIN._sessionEra || ''; }
  function _pinSetHomeEra(era) { PIN._sessionEra = era || ''; }
  // What the next photo will be stamped with.
  function _pinActiveEra() { return PIN._pinOneShot || _pinHomeEra(); }

  function _pinEraLabel(era) {
    if (!era) return 'Not set';
    // v0.9.1504 (task #29): a maker-less tag says what IS known.
    try {
      var _tp0 = (typeof rrTagParse === 'function') ? rrTagParse(era) : null;
      if (_tp0 && _tp0.partial) {
        var _pl0 = (_tp0.period && typeof _RR_PERIOD_LABEL !== 'undefined' && _RR_PERIOD_LABEL[_tp0.period]) || '';
        if (_tp0.era) {   // v0.9.1505: known era + period ("Marx O · Postwar")
          var _d0 = (typeof ERAS !== 'undefined') ? ERAS[_tp0.era] : null;
          var _s0 = _tp0.scale || ((typeof ERA_SCALE !== 'undefined' && ERA_SCALE[_tp0.era]) || '');
          var _lbl0 = _d0 ? _d0.label : _tp0.era;
          // the era label often already says the scale ("Marx O") -- once is enough
          if (_s0 && _lbl0.toUpperCase().split(/\s+/).indexOf(String(_s0).toUpperCase()) >= 0) _s0 = '';
          return [_lbl0, _s0, _pl0].filter(Boolean).join(' \u00b7 ');
        }
        return [(_pl0 || 'Any era'), (_tp0.scale || '')].filter(Boolean).join(' \u00b7 ') + ' \u2014 any maker';
      }
    } catch (e0) {}
    try {
      var d = (typeof ERAS !== 'undefined') ? ERAS[era] : null;
      var scale = (typeof ERA_SCALE !== 'undefined' && ERA_SCALE[era]) ? ERA_SCALE[era] : '';
      if (d) return d.label + (scale ? ' · ' + scale : '');
    } catch (e) {}
    return era;
  }

  // Every era the app knows, grouped by maker — the source for the pickers.
  function _pinEraChoices() {
    var out = [];
    try {
      if (typeof ERAS === 'undefined') return out;
      Object.keys(ERAS).forEach(function (k) {
        var d = ERAS[k];
        if (!d || k === 'all') return;
        out.push({
          key: k,
          maker: d.manufacturer || 'Other',
          scale: (typeof ERA_SCALE !== 'undefined' && ERA_SCALE[k]) ? ERA_SCALE[k] : '',
          // v0.9.1503: every scale the era spans (Pre-War = O AND Standard)
          scales: (typeof ERA_SCALES_MULTI !== 'undefined' && ERA_SCALES_MULTI[k])
                    ? ERA_SCALES_MULTI[k].slice()
                    : ((typeof ERA_SCALE !== 'undefined' && ERA_SCALE[k]) ? [ERA_SCALE[k]] : []),
          label: d.label || k,
          years: d.years || '',
        });
      });
    } catch (e) {}
    return out;
  }

  function _pinRenderBar() {
    var el = document.getElementById('pin-context-bar');
    if (!el) return;
    // Only while a shooting session is running. Brad: "that bar should only show
    // up after you hit the add photos button."
    if (!PIN._pinSession) { el.style.display = 'none'; return; }
    var era = _pinActiveEra();
    var armed = !!PIN._pinOneShot;
    var known = !!era;
    el.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.7rem;'
      + 'padding:0.55rem 0.75rem;border-radius:10px;border:2px solid '
      + (armed ? 'var(--accent)' : (known ? 'rgba(41,128,185,0.55)' : 'var(--border)')) + ';'
      + 'background:' + (armed ? 'rgba(232,64,28,0.10)' : (known ? 'rgba(41,128,185,0.08)' : 'var(--surface2)'));
    el.innerHTML =
      '<span style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);font-weight:700">'
        + (armed ? 'Next photo only' : 'Shooting') + '</span>'
      + '<button onclick="_pinPickContext()" style="flex:1;min-width:150px;text-align:left;padding:0.45rem 0.7rem;border-radius:8px;'
        + 'border:1.5px solid ' + (known ? '#2980b9' : 'var(--border)') + ';background:' + (known ? '#f7f0dc' : 'var(--bg)') + ';'
        + 'color:' + (known ? 'var(--t-link)' : 'var(--text-dim)') + ';font-family:var(--font-head);font-weight:700;font-size:0.9rem;cursor:pointer">'
        + rrEsc(_pinEraLabel(era)) + ' \u25be</button>'
      + (armed
          ? '<button onclick="_pinClearOneShot()" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--border);'
            + 'background:var(--surface2);color:var(--text-mid);font-size:0.78rem;cursor:pointer">Back to '
            + rrEsc(_pinEraLabel(_pinHomeEra())) + '</button>'
          : '')
      + '<button onclick="_pinEndSession()" style="padding:0.45rem 0.8rem;border-radius:8px;border:none;'
        + 'background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;'
        + 'font-size:0.8rem;min-height:38px;cursor:pointer">Done</button>';
  }

  // Ends the shooting session: bar goes away, nothing stays armed.
  window._pinEndSession = function () {
    PIN._pinSession = false;
    PIN._pinOneShot = null;
    PIN._sessionEra = '';
    var el = document.getElementById('pin-context-bar');
    if (el) el.style.display = 'none';
  };

  window._pinClearOneShot = function () { PIN._pinOneShot = null; _pinRenderBar(); };

  // Three dropdowns that narrow each other: maker → scale → line.
  // opts (all optional) — when opts.onPick is given the sheet shows ONE confirm
  // button and hands the era back instead of arming the capture bar. That is
  // how tag mode and the start-of-session prompt reuse this same picker rather
  // than growing a second copy of the maker/scale/line logic.
  window._pinPickContext = function (opts) {
    opts = opts || {};
    var choices = _pinEraChoices().filter(function (c) { return c.maker !== 'Other'; });   // v0.9.1504 (Brad): no "Other" bucket
    if (!choices.length) { showToast('No manufacturers configured yet', 2500, true); return; }
    var cur = opts.current || _pinActiveEra();
    var curDef = choices.filter(function (c) { return c.key === cur; })[0] || null;
    var pick = { maker: curDef ? curDef.maker : '', scale: curDef ? curDef.scale : '', era: cur || '', period: '' };
    // v0.9.1504 (task #29): restore a maker-less tag into the picker.
    var _curTp = (typeof rrTagParse === 'function') ? rrTagParse(cur || '') : null;
    if (_curTp && _curTp.partial) {
      if (_curTp.era) {   // v0.9.1505: "Marx O · Postwar" restores as Marx + period
        var _cd5 = choices.filter(function (c) { return c.key === _curTp.era; })[0] || null;
        pick = { maker: _cd5 ? _cd5.maker : '', scale: _curTp.scale || (_cd5 ? _cd5.scale : ''), era: _curTp.era, period: _curTp.period };
      } else {
        pick = { maker: '*', scale: _curTp.scale, era: '', period: _curTp.period };
      }
    }

    var ov = document.createElement('div');
    ov.id = 'pin-ctx-sheet';
    ov.style.cssText = _PIN_SHEET_OV;
    var card = document.createElement('div');
    card.style.cssText = _pinSheetCardCss(520, 82);
    ov.appendChild(card);
    rrDismissGuard(ov);   // v0.9.1785

    function uniq(a) { var s2 = {}, o = []; a.forEach(function (v) { if (v && !s2[v]) { s2[v] = 1; o.push(v); } }); return o.sort(); }

    function draw() {
      var makers = uniq(choices.map(function (c) { return c.maker; }));
      if (!pick.maker && makers.indexOf('Lionel') >= 0) pick.maker = 'Lionel';
      // v0.9.1504 (task #29, Brad): "Not sure" is a first-class maker —
      // pick scale and period by themselves; the tag stores what IS known.
      var _anyMaker = pick.maker === '*';
      var scaleSet = _anyMaker ? choices.slice() : choices.filter(function (c) { return c.maker === pick.maker; });
      // v0.9.1503: an era can span scales (Pre-War = O AND Standard). The
      // scale list is the union, and the line list keeps every era whose
      // scales INCLUDE the pick -- Scale O no longer hides Pre-War.
      var _scOf = function (c) { return (c.scales && c.scales.length) ? c.scales : [c.scale]; };
      var scales = uniq([].concat.apply([], scaleSet.map(_scOf)));
      if (scales.indexOf(pick.scale) < 0) pick.scale = scales.length === 1 ? scales[0] : '';
      var lines = _anyMaker ? [] : scaleSet.filter(function (c) { return !pick.scale || _scOf(c).indexOf(pick.scale) >= 0; });
      // v0.9.1503 (Brad: "on atlas, scale and line are the same thing"):
      // when every one of a maker's lines is exactly one scale and no two
      // share it (Atlas O/HO/N/Z), the Line dropdown just repeats the Scale
      // dropdown -- show Scale only and derive the line from the pick.
      var _lineIsScale = !_anyMaker && scaleSet.length === scales.length
        && scaleSet.every(function (c) { return _scOf(c).length === 1; });
      // v0.9.1505 (task #30): a line whose one catalog spans periods (Marx,
      // 1927-2004) offers the period too — optional, stored only if picked.
      var _eraPick0 = _anyMaker ? '' : (pick.era || (lines.length === 1 ? lines[0].key : ''));
      var _spansPer = !!(_eraPick0 && typeof ERA_SPANS_PERIODS !== 'undefined' && ERA_SPANS_PERIODS[_eraPick0]);
      if (!lines.some(function (c) { return c.key === pick.era; })) pick.era = lines.length === 1 ? lines[0].key : '';

      function sel(id, label, opts, val, hint) {
        return '<div style="margin-bottom:0.7rem">'
          + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);font-weight:700;margin-bottom:0.25rem">' + label + '</div>'
          + '<select id="' + id + '" style="width:100%;padding:0.6rem 0.7rem;border-radius:8px;border:1.5px solid var(--border);'
            + 'background:var(--surface2);color:var(--text);font-size:0.95rem;min-height:46px;box-sizing:border-box">'
          + (val ? '' : '<option value="">Choose…</option>')
          + opts.map(function (o) {
              return '<option value="' + rrEsc(o.v) + '"' + (o.v === val ? ' selected' : '') + '>' + rrEsc(o.t) + '</option>';
            }).join('')
          + '</select>'
          + (hint ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.2rem">' + hint + '</div>' : '')
          + '</div>';
      }

      card.innerHTML =
        '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;margin-bottom:0.15rem">'
          + rrEsc(opts.title || 'What are you photographing?') + '</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.8rem">'
          + rrEsc(opts.blurb || 'This gets saved with each photo, so the app knows which catalog to look in.') + '</div>'
        + sel('pin-ctx-maker', 'Manufacturer', [{ v: '*', t: 'Not sure \u2014 any maker' }].concat(makers.map(function (m) { return { v: m, t: m }; })), pick.maker, '')
        + (scales.length > 1 ? sel('pin-ctx-scale', 'Scale', scales.map(function (m) { return { v: m, t: m }; }), pick.scale, '') : '')
        + (lines.length > 1 && !_lineIsScale ? sel('pin-ctx-era', 'Line / period',
              lines.map(function (c) { return { v: c.key, t: c.label + (c.years ? '  (' + c.years + ')' : '') }; }), pick.era, '') : '')
        + ((_anyMaker || _spansPer) ? sel('pin-ctx-period', 'Era / period', [
              { v: 'prewar',  t: 'Pre-War  (1901-1944)' },
              { v: 'postwar', t: 'Postwar  (1945-1969)' },
              { v: 'modern',  t: 'Modern  (1970-Today)' }], pick.period,
              _spansPer ? 'Optional \u2014 this maker\u2019s one catalog spans periods' : '') : '')
        + '<div style="display:flex;gap:0.5rem;margin-top:0.9rem;flex-wrap:wrap">'
        + (opts.onPick
            ? '<button id="pin-ctx-ok" style="flex:1;min-width:140px;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-weight:700;font-size:0.92rem;min-height:48px;cursor:pointer">'
              + rrEsc(opts.okLabel || 'Use this') + '</button>'
            : '<button id="pin-ctx-once" style="flex:1;min-width:140px;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-weight:700;font-size:0.92rem;min-height:48px;cursor:pointer">Just this one</button>'
              + '<button id="pin-ctx-keep" style="flex:1;min-width:140px;padding:0.7rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-weight:700;font-size:0.92rem;min-height:48px;cursor:pointer">Keep it here</button>')
        + '</div>'
        + '<button id="pin-ctx-cancel" style="width:100%;margin-top:0.5rem;padding:0.6rem;border-radius:9px;border:none;background:none;color:var(--text-dim);font-size:0.88rem;cursor:pointer">'
          + rrEsc(opts.cancelLabel || 'Cancel') + '</button>';

      var mk = card.querySelector('#pin-ctx-maker');
      if (mk) mk.onchange = function () { pick.maker = this.value; pick.scale = ''; pick.era = ''; pick.period = ''; draw(); };
      var pr = card.querySelector('#pin-ctx-period');   // v0.9.1504
      if (pr) pr.onchange = function () { pick.period = this.value; };
      var sc = card.querySelector('#pin-ctx-scale');
      if (sc) sc.onchange = function () { pick.scale = this.value; pick.era = ''; draw(); };
      var er = card.querySelector('#pin-ctx-era');
      if (er) er.onchange = function () { pick.era = this.value; };

      function chosen() {
        // v0.9.1504: a maker-less pick stores what IS known ('?|O|postwar').
        if (_anyMaker) return (pick.scale || pick.period) ? ('?|' + (pick.scale || '') + '|' + (pick.period || '')) : '';
        // v0.9.1505: a span-era with a period picked keeps BOTH facts.
        var _ek5 = pick.era || (lines.length === 1 ? lines[0].key : '');
        if (_ek5 && pick.period && typeof ERA_SPANS_PERIODS !== 'undefined' && ERA_SPANS_PERIODS[_ek5])
          return '?|' + (pick.scale || '') + '|' + pick.period + '|' + _ek5;
        if (pick.era) return pick.era;
        var only = lines.length === 1 ? lines[0].key : '';
        return only;
      }
      if (opts.onPick) {
        card.querySelector('#pin-ctx-ok').onclick = function () {
          var e2 = chosen();
          if (!e2) { showToast('Pick the line first', 2200, true); return; }
          ov.remove();
          try { opts.onPick(e2); } catch (eP) { console.warn('[inbox] picker callback failed', eP && eP.message); }
        };
      } else {
        card.querySelector('#pin-ctx-once').onclick = function () {
          var e2 = chosen();
          if (!e2) { showToast('Pick the line first', 2200, true); return; }
          PIN._pinOneShot = e2; ov.remove(); _pinRenderBar();
          showToast('Next photo only: ' + _pinEraLabel(e2), 3000);
        };
        card.querySelector('#pin-ctx-keep').onclick = function () {
          var e2 = chosen();
          if (!e2) { showToast('Pick the line first', 2200, true); return; }
          _pinSetHomeEra(e2); PIN._pinOneShot = null; ov.remove(); _pinRenderBar();
          showToast('Now shooting ' + _pinEraLabel(e2), 3000);
        };
      }
      card.querySelector('#pin-ctx-cancel').onclick = function () {
        ov.remove();
        if (opts.onCancel) { try { opts.onCancel(); } catch (eC) {} }
      };
    }
    draw();
    document.body.appendChild(ov);
  };

  // ══ v0.9.1047 — per-photo metadata ═══════════════════════════════════════
  // Until now the only thing a photo remembered was its filename:
  //   "INBOX <uploadTs> g<groupId> <original name>"
  // Enough to stack a group and nothing else — nowhere to put era, group kind,
  // unit role, what the reader made of it, or whether it has been dealt with.
  // Every planned inbox feature needs those.
  //
  // They live in the Drive file's own appProperties: private to this app, no
  // new Google permission, survives renames, and Drive can filter on them
  // server-side later. Keys are short because Drive caps key+value at 124
  // bytes per property.
  //
  //   rrV    schema version           rrNum   item number read or confirmed
  //   rrEra  era key ('pw','mth_ho')  rrStat  new|stamped|read|confirmed|filed
  //   rrGrp  group id                 rrConf  hi|lo — how sure the read was
  //   rrKind single|aa|ab|aba|tender|set|box
  //   rrRole role in the group ('p','d','b','tender','set','box')
  //
  // ONE era key carries maker, scale and period together — 'mth_ho' is MTH, HO,
  // modern — so there is no way to store a combination that never existed.
  // v0.9.1504 (task #29): one exception — the maker-less tag
  // '?|<scale>|<period>' stores PARTIAL knowledge without inventing a maker.
  // rrTagParse (config.js) is the one reader of that shape.
  //
  // No migration: reads fall back to the filename, so photos taken before today
  // keep working untouched and simply know less until something writes.
  var _PIN_META_V = '1';

  // v0.9.1076 (Brad: "most of these i have to rescan for them to read
  // anything"). Once the free reader failed on a photo it was marked tried and
  // never looked at again — so every improvement made today was invisible on
  // the photos that most needed it, until he re-scanned each one by hand. Reads
  // now carry the version of the reader that produced them, and the automatic
  // pass retries anything read by an older one. Bump this whenever the reading
  // logic changes; it costs nothing but time, and only on photos that failed.
  var READER_VER = '1107';

  // v0.9.1283: dragged order first, listing order for the rest. Pure, so the
  // suite lifts and runs it. A photo with no ord (0) keeps its listing slot
  // AFTER every ordered one — dragging some photos must never scramble the
  // ones that were not touched.
  function _pinSortByOrd(files) {
    var any = (files || []).some(function (f) { return f._meta && f._meta.ord > 0; });
    if (!any) return files;
    return files.map(function (f, i) {
      return { f: f, k: (f._meta && f._meta.ord > 0) ? f._meta.ord : 900 + i, i: i };
    }).sort(function (a, b) { return a.k - b.k || a.i - b.i; })
      .map(function (x) { return x.f; });
  }
  if (typeof window !== 'undefined') window._pinSortByOrd = _pinSortByOrd;

  function _pinMetaOf(file) {
    var ap = (file && file.appProperties) || {};
    var out = {
      v:    ap.rrV    || '',
      era:  ap.rrEra  || '',
      // v0.9.1132 (audit #6): '-' is the DELIBERATELY UNGROUPED marker. An empty
      // or missing rrGrp cannot mean that, because it is also what every photo
      // starts with — and the filename fallback below would just re-derive the
      // group. See _pinUngroup.
      grp:  (ap.rrGrp === '-') ? '' : (ap.rrGrp || ''),
      kind: ap.rrKind || '',
      role: ap.rrRole || '',
      // v0.9.1297 (Brad): what the photo IS — Boxcar, Paper, Engine… Set by
      // the tag bar's Type picker; the readers use it as a hint (see
      // _pinPreferOf / _pinAiHints / _pinBestMaster).
      type: ap.rrType || '',
      // v0.9.1433 (Brad): which SIDE of the item the photo shows, stamped by
      // Quick Capture's view buttons at the moment the shot is taken. Values
      // are the wizard's own slot keys (RSV/LSV/FV/BKV/TV/BV) plus 'EXTRA'
      // for detail shots, so the wizard can file each photo without a lookup.
      view: ap.rrView || '',
      num:  ap.rrNum  || '',
      stat: ap.rrStat || '',
      conf: ap.rrConf || '',
      // v0.9.1771 — the three that make a read the ACCOUNT'S, not the device's.
      // rt: when this answer was decided (epoch ms, as a string). rej: the
      // numbers the user has ruled out on this photo. crop: when the photo's
      // bytes were last replaced, so ANY device knows Drive's preview is stale
      // — not just the one that did the cropping.
      rt:   ap.rrRt   || '',
      rej:  ap.rrRej  || '',
      crop: ap.rrCrop || '',
      // v0.9.1283 (Brad: "i need to be able to drag the pictures back and
      // forth"): the photo's place in its group, written when he drags. 0
      // means never ordered — listing order stands, as it always has.
      ord:  parseInt(ap.rrOrd, 10) || 0,
    };
    // Filename fallback — but NEVER for a photo the user explicitly split apart.
    // Quick Capture names phone photos "INBOX 3 g<id> …", so before v0.9.1132
    // "Split apart" cleared the tag, this fallback read the name a moment later,
    // and the stack silently re-formed. The confirmation said it had worked.
    if (!out.grp && ap.rrGrp !== '-' && file && file.name) {
      var m = String(file.name).match(/^INBOX \d+ g(\S+)/);
      if (m) out.grp = m[1];
    }
    if (!out.stat) out.stat = out.num ? 'read' : 'new';
    if (!out.kind) out.kind = 'single';
    return out;
  }

  // Merge a patch into a file's appProperties. Drive merges the keys you send
  // and deletes any whose value is null, so only what changed goes over.
  async function _pinMetaSet(fileId, patch) {
    if (!fileId || !patch) return false;
    var map = { era:'rrEra', grp:'rrGrp', kind:'rrKind', role:'rrRole', type:'rrType', num:'rrNum', stat:'rrStat', conf:'rrConf', ord:'rrOrd', view:'rrView', rt:'rrRt', rej:'rrRej', crop:'rrCrop' };   // ord: v0.9.1283, drag order · type: v0.9.1297 · view: v0.9.1433
    var props = { rrV: _PIN_META_V };
    Object.keys(patch).forEach(function (k) {
      if (!map[k]) return;
      var val = patch[k];
      props[map[k]] = (val === null || val === undefined || val === '') ? null : String(val).slice(0, 100);
    });
    try {
      await driveRequest('PATCH', '/files/' + fileId + '?fields=id', { appProperties: props });
      // v0.9.1623 (Brad's 238): Drive took the write, but every in-memory
      // reader kept the OLD appProperties — above all the wizard handoff,
      // which reads _pinMetaOf(f) and so dealt his carefully slotted
      // engine+tender photos in shooting order (his folder: Top/Left Side/
      // Front/Right Side/Back). One chokepoint fixes every reader at once:
      // merge the same props into the local file object and refresh its
      // parsed _meta, so what Drive just accepted is true everywhere.
      try { _pinMetaMergeLocal(fileId, props); } catch (eM) {}
      return true;
    } catch (e) {
      console.warn('[inbox] could not save photo details', fileId, e && e.message);
      return false;
    }
  }

  // The local half of a stamp write. null deletes a key, exactly as Drive
  // does — the two copies cannot drift. Exposed for the test harness.
  function _pinMetaMergeLocal(fileId, props) {
    (PIN._groups || []).forEach(function (g) {
      (g.files || []).forEach(function (f) {
        if (!f || f.id !== fileId) return;
        f.appProperties = f.appProperties || {};
        Object.keys(props || {}).forEach(function (k) {
          if (props[k] === null || props[k] === undefined) delete f.appProperties[k];
          else f.appProperties[k] = props[k];
        });
        f._meta = _pinMetaOf(f);
      });
    });
  }

  // Same patch across several photos, four at a time so a batch of a hundred
  // does not open a hundred simultaneous requests. Returns how many actually
  // succeeded, so the caller can tell the user the truth.
  async function _pinMetaSetMany(fileIds, patch, onProgress) {
    var ids = (fileIds || []).slice(), ok = 0, done = 0;
    while (ids.length) {
      var slice = ids.splice(0, 4);
      var results = await Promise.all(slice.map(function (id) { return _pinMetaSet(id, patch); }));
      results.forEach(function (r) { if (r) ok++; });
      done += slice.length;
      if (onProgress) { try { onProgress(done, ok); } catch (e) {} }
    }
    return ok;
  }

  if (typeof window !== 'undefined') {
    window._pinMetaOf = _pinMetaOf;
    window._pinMetaSet = _pinMetaSet;
    window._pinMetaMergeLocal = _pinMetaMergeLocal;
    window._pinMetaSetMany = _pinMetaSetMany;
  }

  // ══ v0.9.1087 — repair stored answers for free ═══════════════════════════
  // Brad has now paid three tokens for the same rocket flatcar, and the LAST
  // one stored the reader's full answer — with "6175" sitting right in it. The
  // reconciliation logic improved after that read was stored; nothing should
  // make him pay a fourth time for a comparison we can run locally. On every
  // inbox load, any stored answer whose number is off-era is re-reconciled
  // against its own saved text. No network, no tokens — just reading what we
  // already bought more carefully.
  function _pinReconcileStored() {
    try {
      if (typeof findMaster !== 'function' || typeof _pinReconcileAiNum !== 'function') return;
      var ids = _ids(), changed = false;
      // v0.9.1166: EVERY photo in the group, not just the readable one. Reads are
      // stored per photo — since per-member reads landed, a set's second car or a
      // re-read of a different angle keeps its own entry — but this walked only
      // _pinReadFid(g), so any read saved under a non-lead photo was never
      // repaired. Silent, and invisible: the entry simply kept a stale number
      // forever while its group-mate got fixed. Found while verifying v0.9.1165.
      var _files = [];
      PIN._groups.forEach(function (g) {
        (g.files || []).forEach(function (f) { if (f && f.id) _files.push({ g: g, fid: f.id }); });
      });
      _files.forEach(function (item) {
        var g = item.g, fid = item.fid;
        var e = fid && ids[fid];
        if (!e || !e.aiRaw || !e.num) return;
        var prefer = _pinPreferOf(g);
        if (!_prefEras(prefer).length) return;   // v0.9.1165: multi-era filters count
        var rc = _pinReconcileAiNum(
          { itemNum: e.num, description: e.desc || '', title: '', formNumber: '' },
          e.aiRaw, prefer);
        if (rc && rc.num && rc.num !== e.num) {
          e.aiSku = e.aiSku || rc.swappedFrom || e.num;
          e.num = rc.num;
          // v0.9.1164: same rule as the live path — a word match is offered, not
          // asserted, and says what it matched.
          if (rc.viaDesc) {
            e.guess = 1;
            e.viaDesc = true;
            e.descOf = rc.descOf || '';
            e.dbg = Object.assign({}, e.dbg || {}, { viaDesc: rc.viaDesc });
          } else {
            e.guess = 0;                     // in-era catalog hit
          }
          changed = true;
        }
      });
      if (changed) { _idsSave(ids); console.info('[inbox] repaired stored reads from their own saved answers'); }
    } catch (e) { console.warn('[inbox] stored-read repair failed', e && e.message); }
  }

  // ══ v0.9.1412 — READ-STATE THAT FOLLOWS THE ACCOUNT, NOT THE DEVICE ═══════
  //
  // Brad: phone said "129 to read", desktop said "1" (desktop right). The cause:
  // a photo's read record lived ONLY in that device's localStorage (rr_inbox_ids),
  // so a photo read on the desktop looked unread on the phone — and the phone
  // would have offered to PAY to re-read it. Refresh re-listed the folder but
  // never carried the reads across.
  //
  // The fix rides the found number on the Drive file itself, in the SAME
  // appProperties the tag system already uses (rrNum / rrConf — NOT rrStat, so
  // a photo's 'filed'/'stamped' status is never clobbered; _pinMetaOf already
  // derives 'read' from a present number). Two directions, both at load:
  //
  //   PULL (synchronous, free): Drive says this photo was read (rrNum) but this
  //     device has no current record → seed one, so the count and the paid
  //     button are correct the instant the inbox draws.
  //   PUSH (async, throttled, best-effort): this device has a read Drive is not
  //     stamped for → stamp it. On the first load after this ships, the desktop
  //     backfills every read it already had; afterwards it just keeps Drive
  //     current. A failed stamp never breaks a load — the next load retries.
  //
  // The read LOOP is untouched: syncing at load alone converges both devices,
  // and keeps the money-sensitive paid button honest without threading Drive
  // writes through the reader.
  // v0.9.1771 — the rejected list, packed for a Drive appProperty. Values are
  // capped at 100 characters there, so entries are dropped WHOLE rather than
  // letting a cut land mid-number and invent a rejection nobody made.
  function _rejStr(list) {
    var out = [], len = 0;
    (list || []).forEach(function (v) {
      var t = String(v == null ? '' : v).trim();
      if (!t || out.indexOf(t) >= 0) return;
      if (len + t.length + 1 > 95) return;
      out.push(t); len += t.length + 1;
    });
    return out.join(',');
  }
  function _rejList(str) {
    return String(str || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
  }

  function _pinSyncReadState(files) {
    var ids = _ids(), seeded = false, toPush = [], cropSeen = [];
    (files || []).forEach(function (f) {
      if (!f || !f.id) return;
      var meta = f._meta || _pinMetaOf(f);
      var local = ids[f.id];
      var localRead = !!(local && local.rv === READER_VER && (local.num || local.guess));
      var driveNum = meta && meta.num;
      var driveRt  = (meta && parseInt(meta.rt, 10)) || 0;
      var localRt  = (local && parseInt(local.rt, 10)) || 0;
      var driveRej = _rejList(meta && meta.rej);
      var localRej = (local && local.rejected) || [];
      var sameNum  = String(driveNum || '') === String((local && local.num) || '');
      var sameRej  = _rejStr(driveRej) === _rejStr(localRej);
      // v0.9.1771 — a photo cropped on ANY device needs its real bytes here.
      if (meta && meta.crop) cropSeen.push(f.id);

      if (driveNum && !localRead) {
        // PULL — Drive knows this read, we don't. Seed a minimal record; keep
        // any local fields we happen to have, but set the number and mark it
        // read at the current reader so the scan skips it and paid excludes it.
        // A read with no stamp on it is pre-1771: call it time 1, so anything
        // decided since beats it rather than the two sides tying forever.
        ids[f.id] = Object.assign({}, local || {}, {
          num: driveNum,
          guess: (meta.conf === 'lo') ? 1 : 0,
          rejected: driveRej.length ? driveRej : localRej,
          rt: driveRt || 1,
          rv: READER_VER, tried: 1, free: 1, fromDrive: 1
        });
        seeded = true;
      } else if (localRead && (!sameNum || !sameRej)) {
        // ══ THE FIGHT THIS ENDS ═══════════════════════════════════════════
        // Until now the device that was asking always won: it pushed its own
        // answer over Drive's without ever comparing the two. So a re-scan on
        // the phone pushed 6427 up, the desktop's next load pushed 6464-525
        // straight back, and the two overwrote each other on every single load
        // — whichever screen was opened last looked right and they could never
        // converge. Brad, 2026-09-19. Compare the CLOCKS, not the caller.
        if (driveNum && driveRt > localRt) {
          ids[f.id] = Object.assign({}, local || {}, {
            num: driveNum,
            guess: (meta.conf === 'lo') ? 1 : 0,
            rejected: driveRej,
            rt: driveRt,
            rv: READER_VER, tried: 1, fromDrive: 1
          });
          seeded = true;
        } else if (local.num || localRej.length) {
          // PUSH — this device holds the newer answer (or the only one).
          // The rejections ride along: without them, a device that pulls a
          // read down rebuilds it with an EMPTY exclusion list and re-offers
          // the very numbers the user already ruled out.
          toPush.push({ id: f.id, num: local.num, guess: local.guess,
                        rej: _rejStr(localRej), rt: localRt || Date.now() });
        }
      }
    });
    if (cropSeen.length) {
      try {
        var cm = _cropped(), cAdd = false;
        cropSeen.forEach(function (id) { if (!cm[id]) { cm[id] = 1; cAdd = true; } });
        if (cAdd) _croppedSave(cm);
      } catch (eC) {}
    }
    if (seeded) _idsSave(ids);
    if (toPush.length) {
      (async function () {
        for (var i = 0; i < toPush.length; i += 4) {
          var slice = toPush.slice(i, i + 4);
          try {
            await Promise.all(slice.map(function (p) {
              return _pinMetaSet(p.id, { num: p.num, conf: p.guess ? 'lo' : 'hi',
                                        rej: p.rej || null, rt: String(p.rt) });
            }));
          } catch (e) { /* best-effort — the next load retries whatever failed */ }
        }
      })();
    }
    return seeded;
  }

  // v0.9.1601: the ONE group builder — the live listing and the offline
  // cached listing flow through the same code, so cached groups can never
  // drift from real ones. Returns the key map (the caller prunes _sel with
  // it); sets _groups and _thumbLink as the inline code always did.
  function _pinBuildGroups(files) {
    var map = {}, order = [];
    PIN._thumbLink = {};
    files.forEach(function (f) {
      if (f.thumbnailLink) PIN._thumbLink[f.id] = f.thumbnailLink;
      // v0.9.1047: metadata first, filename as the fallback — so photos from
      // before today group exactly as they always did.
      f._meta = _pinMetaOf(f);
      var key = f._meta.grp ? 'g' + f._meta.grp : 'f' + f.id;
      if (!map[key]) { map[key] = { key: key, files: [], kind: f._meta.kind, era: f._meta.era }; order.push(key); }
      map[key].files.push(f);
    });
    PIN._groups = order.map(function (k) { return map[k]; });
    // v0.9.1283: a dragged order outranks the listing order, per group.
    PIN._groups.forEach(function (g) { g.files = _pinSortByOrd(g.files); });
    return map;
  }

  // v0.9.1704: ONE refresh at a time. Refresh pressed twice, or the inbox
  // watcher (below) landing while a refresh is already listing, used to start
  // a second full listing beside the first — two renders racing to draw the
  // same grid. A second call now simply rides the refresh in flight.
  var _pinRefreshFlight = null;
  window._pinRefresh = async function () {
    if (_pinRefreshFlight) return _pinRefreshFlight;
    _pinRefreshFlight = _pinRefreshRun();
    try { return await _pinRefreshFlight; } finally { _pinRefreshFlight = null; }
  };
  async function _pinRefreshRun() {
    if (!_ensurePage()) return;
    // v0.9.1590: the staged strip re-reads its store on every refresh, and a
    // refresh is a fine moment to try the drain (it costs nothing when the
    // store is empty or the connection is still down).
    try { _stageRenderStrip(); } catch (e) {}
    try { _stageDrain(); } catch (e) {}
    // v0.9.1775: the Photo ID switch is the account's now — reconcile it here,
    // where Drive is already in play and the button text that depends on it is
    // about to be drawn. Guarded and fire-and-forget: it runs once per session
    // and a failure never costs a read.
    try { if (window.rrAiSyncOptOut) window.rrAiSyncOptOut(); } catch (e) {}
    // v0.9.1601 (Brad's brainstorm): offline, the inbox shows its SAVED
    // self — the last complete listing, grouped by the same builder, with
    // thumbnails from the on-device bank. No prune, no read-state sync, no
    // reconcile runs against a cached listing: those only ever act on a
    // listing Drive just confirmed.
    if (_pinOffline()) {
      var _cached = await _inboxCacheLoad();
      if (!_cached || !_cached.files || !_cached.files.length) {
        _status('You\u2019re offline and no saved copy of your inbox exists on this device yet \u2014 it saves itself whenever the inbox loads online.');
        return;
      }
      _pinBuildGroups(_cached.files);
      PIN._pinHaveListing = true;   // v0.9.1871
      _render();
      var _when = '';
      try { _when = new Date(_cached.at).toLocaleString(); } catch (eW) {}
      _status('\ud83d\udcf5 Offline \u2014 showing your inbox as saved ' + _when + '. Photos load from this device; identify needs a connection.');
      return;
    }
    _status('Loading inbox…');
    // v0.9.1710 (press audit B2): a read that fails in a few milliseconds
    // replaced "Loading inbox…" with the same failure text that was already
    // there, so a repeat press of Refresh looked like nothing. The failure
    // text now waits for "Loading inbox…" to have been on screen ~400ms — and
    // only if no newer refresh has started since (the sequence number).
    var _rfStart = Date.now(), _rfSeq = (window._pinRefreshSeq = (window._pinRefreshSeq || 0) + 1);
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      // v0.9.1058 — THE BUG. Drive returns only the fields you ask for, and
      // appProperties was not among them. Every era, group kind, unit role and
      // status the app has written since v0.9.1047 saved correctly to Drive and
      // was then invisible on the next load: _pinMetaOf read an empty object
      // every time. Tagging 80 photos looked like it did nothing, because as
      // far as the app could see, it had. One missing word.
      // v0.9.1131 (audit #5): this asked for 200 files and never followed
      // nextPageToken, so the inbox could only ever SEE the newest 200 — and
      // sorted newest-first, the ones it could not see were the oldest, i.e.
      // exactly the backlog. Now it pages to the end. _pinListComplete records
      // whether we really reached it, because the prune below depends on that.
      var files = [], _pageTok = '', _guard = 0, _pinListComplete = true;
      do {
        // v0.9.1275 (R15): a failed SECOND page used to abort the whole
        // render — one bad request at a train show and an inbox that had
        // already loaded 200 photos showed nothing at all. If any page has
        // landed, keep what we have, mark the listing incomplete (which the
        // prune below already respects), and say so. A first-page failure
        // still throws — there is nothing partial to show.
        var res;
        try {
          // v0.9.1704: modifiedTime rides along (same request, no extra cost)
          // so this listing can be the inbox watcher's fingerprint baseline.
          res = await driveRequest('GET', '/files?q=' + q +
            '&fields=nextPageToken,files(id,name,createdTime,modifiedTime,appProperties,thumbnailLink)&orderBy=createdTime desc&pageSize=200' +
            (_pageTok ? '&pageToken=' + _pageTok : ''));
        } catch (ePage) {
          if (!files.length) throw ePage;
          _pinListComplete = false;
          console.warn('[Inbox] listing page failed — showing the ' + files.length + ' already loaded:', ePage);
          break;
        }
        ((res && res.files) || []).forEach(function (f) { files.push(f); });
        _pageTok = (res && res.nextPageToken) || '';
        if (++_guard > 40) { _pinListComplete = false; break; }   // ~8,000 photos; never spin forever
      } while (_pageTok);
      // v0.9.1704: this listing is what the screen is about to show, so it is
      // the fingerprint the inbox watcher compares Drive against. Only a
      // COMPLETE listing may be a baseline — a partial one would make every
      // photo past the cut look like a change on another device.
      PIN._pinWatchSig = _pinListComplete ? _pinWatchSigOf(files) : null;
      // Group by the g<id> tag; untagged files are their own group.
      var map = _pinBuildGroups(files);
      // v0.9.1326 (MEASURED): the listing now asks for thumbnailLink, which
      // files.list returns in the SAME request at no extra cost. Without it,
      // loadDriveThumb was handed null and had to fetch each photo's link
      // one at a time: opening a 500-photo inbox made 500 separate Drive
      // calls, six concurrent, and took 34.5s at a 400ms RTT before the last
      // picture even started loading (200 photos: 14.0s; 50: 3.9s). The floor
      // is one call. This is the same pattern drive.js already uses for
      // collection photos (see its files.list with thumbnailLink, and the
      // photos[0].thumbnailLink || null hand-off).
      //
      // Kept as a side map rather than a data- attribute on purpose: these are
      // long signed URLs, and putting 500 of them in the grid's HTML would
      // trade a network win for a DOM one.
      try { _pinReconcileStored(); } catch (eRS) {}
      // v0.9.1601: a COMPLETE listing is the inbox's offline memory — save
      // it (ids, names, tags; never the expiring signed thumbnail links).
      if (_pinListComplete) { try { _inboxCacheSave(files); } catch (eCS) {} }
      // v0.9.1412 — reconcile read-state with Drive so the phone and the
      // desktop agree (and the phone never pays to re-read what the desktop
      // already read). PULL is synchronous so the counts below are right;
      // PUSH runs in the background.
      try { _pinSyncReadState(files); } catch (eSY) { console.warn('[inbox] read-state sync failed', eSY && eSY.message); }
      // Drop selections that no longer exist
      Object.keys(PIN._sel).forEach(function (k) { if (!map[k]) delete PIN._sel[k]; });
      // Prune stored reads for photos that left the inbox.
      // v0.9.1131 (audit #5, the damaging half): this ran against whatever the
      // listing happened to contain. Paired with the 200-file cap it deleted
      // the stored read for every photo past the first 200 — including PAID
      // reads the user bought. It only ever runs on a listing we know is
      // complete now; a truncated listing prunes nothing.
      (function () {
        if (!_pinListComplete) { console.warn('[Inbox] listing truncated — skipping prune'); return; }
        var live = {}; files.forEach(function (f) { live[f.id] = true; });
        var ids = _ids(), changed = false;
        Object.keys(ids).forEach(function (k) { if (!live[k]) { delete ids[k]; changed = true; } });
        if (changed) _idsSave(ids);
        // v0.9.1131 (audit #11): the failed-read record was never pruned at
        // all, and each entry carries raw text plus a debug object. Left alone
        // it grows until localStorage is full — at which point EVERY write in
        // this file fails silently, because they are all in quiet catch blocks.
        try {
          var ft = _freeTried(), ch2 = false;
          Object.keys(ft).forEach(function (k) { if (!live[k]) { delete ft[k]; ch2 = true; } });
          if (ch2) _freeTriedSave(ft);
        } catch (eFT) {}
      })();
      PIN._pinHaveListing = true;   // v0.9.1871: the inbox is now KNOWN — empty or not
      _render();
      // v0.9.1275 (R15): a partial listing is drawn, but never passed off as
      // the whole inbox.
      _status(_pinListComplete ? '' : 'Some photos could not be loaded — this is a partial view. Hit Refresh to try again.');
      // v0.9.1297 (Brad): NO automatic read. "right now it auto reads
      // everything i put into the photo inbox. let me be able to crop, tag
      // and group items, and then let me hit the identify my items button."
      // The reads run better for the wait — by then the photos are cropped
      // and carry their maker/era/type tags. _pinIdentifyItems is the ONE
      // trigger; the button below shows how much is waiting.
      try { _updateIdentifyBtn(); } catch (eIB) {}
    } catch (e) {
      console.error('[Inbox] refresh:', e);
      var _rfMsg = (typeof rrIsSignInError === 'function' && rrIsSignInError(e))
        ? 'You\u2019re signed out \u2014 sign in to load the inbox.'                         // v0.9.1710 (press audit B2)
        : 'Could not load the inbox \u2014 check your connection and try Refresh.';
      var _rfWait = Math.max(0, 400 - (Date.now() - _rfStart));
      setTimeout(function () { if (window._pinRefreshSeq === _rfSeq) _status(_rfMsg); }, _rfWait);
    }
  };

  // ══ v0.9.1704 — THE INBOX WATCHER ═══════════════════════════════════════
  // Brad, 2026-09-09: "when i add photos to the inbox from my app, my desktop
  // app has to be refreshed to see them. can we not automatically refresh the
  // desktop when we make edits on the phone. i am okay with that happening
  // when i hit done or apply."
  //
  // The photos themselves are the signal. The phone puts them in the Drive
  // inbox folder, so the desktop needs nothing from the phone — it needs to
  // LOOK. About once a minute, while the Photo Inbox page (or the Dashboard,
  // for its inbox card) is on screen, it asks Drive for a fingerprint of the
  // folder: every photo's id and last-changed time, nothing else. One small
  // request. If the fingerprint differs from what the screen was built from —
  // a photo added, cropped, tagged or filed away on another device — the inbox
  // reloads itself exactly as if Refresh had been pressed, and the badge
  // follows. Done and Apply on the phone are exactly the moments the folder
  // changes, so they are exactly the moments this notices.
  //
  // THREE RULES, each pinned in tests/inbox_watch_tests.js:
  //   1. It reloads only on a REAL difference. Same fingerprint, no redraw.
  //   2. It holds still while the user is mid-anything — a review card, the
  //      crop screen, select mode, a panel, a drag, a running job, a refresh
  //      already in flight, the app hidden or offline. A change seen while
  //      held is not dropped: the fingerprint is left unmatched, so the next
  //      idle tick reloads. Deferred, never dropped (the v0.9.1703 rule).
  //   3. Phones and tablets NEVER poll. The phone is the device making the
  //      changes, and polling costs battery for nothing.
  //
  // Why not Drive's changes feed: it is cheaper on the wire but needs a saved
  // page token per device with its own expiry rules — state that can go stale
  // or corrupt. A fingerprint has no state to lose; the worst case is one
  // redundant reload. Deliberately the simpler tool.
  var _WATCH_MS = 60000;           // one look a minute — the one number to tune
  var _WATCH_EVENT_GAP_MS = 5000;  // focus + visibility fire together; look once
  var _WATCH_RETRY_MS = 15000;     // one quick second look after a failed one
  var _pinWatchRetried = false;    // ONE quick retry per failure streak, never a 15s hammer
  PIN._pinWatchSig = null;         // fingerprint the screen was built from; null = none yet
  var _pinWatchBusy = false;       // a look is in flight
  var _pinWatchTimer = null;
  var _pinWatchLastAt = 0;

  // The fingerprint: order-independent, so a re-sorted listing is not a change.
  function _pinWatchSigOf(files) {
    try {
      return (files || []).map(function (f) { return f.id + '@' + (f.modifiedTime || ''); }).sort().join('|');
    } catch (e) { return null; }
  }

  // Where is the user? Only two screens show the inbox: the page itself, and
  // the dashboard when its Photo Inbox card or panel is placed. Anywhere else
  // there is nothing to keep fresh, so nothing is asked of Drive.
  function _pinWatchScreen() {
    try {
      var p = document.querySelector('.page.active');
      var id = (p && p.id) || '';
      if (id === 'page-photo-inbox') return 'inbox';
      if (id === 'page-dashboard' && (document.getElementById('pin-panel-grid') || document.getElementById('pin-card-value'))) return 'dashboard';
    } catch (e) {}
    return '';
  }

  // Why the watcher must hold still right now, or '' when it may act. This is
  // not a user-action guard — nobody pressed anything, so there is nothing to
  // say out loud — it only READS the busy flag into a reason for the console.
  function _pinWatchHold() {
    try {
      if (window.IS_MOBILE_UA) return 'phone';
      if (document.hidden) return 'hidden';
      if (_pinOffline()) return 'offline';
      if (!_qcToken()) return 'signed out';
      var job = PIN._busy ? ('busy: ' + (_busyWhat || 'a job')) : '';
      if (job) return job;
      if (_pinRefreshFlight) return 'refresh in flight';
      if (window._rrCropOpen) return 'crop screen';
      if (PIN._selectMode) return 'select mode';
      if (window._pinInternalDrag) return 'drag';
      var open = ['pin-review-ov', 'pin-rv-slotpick', 'pin-ctx-sheet', 'pin-wf-sheet', 'pin-help-sheet', 'pin-grp-panel'];
      for (var i = 0; i < open.length; i++) if (document.getElementById(open[i])) return open[i];
      var wiz = document.getElementById('wizard-modal');
      if (wiz && wiz.classList.contains('open')) return 'wizard';
    } catch (e) { return 'error'; }
    return '';
  }

  // One look: ids + modifiedTime for the whole folder, 1,000 per page. A
  // folder too big to fingerprint in a few pages says nothing this tick rather
  // than comparing a partial list (that would read as everything changed).
  async function _pinWatchProbe() {
    var fid = await _folder();
    var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
    var files = [], tok = '', guard = 0;
    do {
      var r = await driveRequest('GET', '/files?q=' + q + '&fields=nextPageToken,files(id,modifiedTime)&pageSize=1000' +
        (tok ? '&pageToken=' + tok : ''));
      ((r && r.files) || []).forEach(function (f) { files.push(f); });
      tok = (r && r.nextPageToken) || '';
    } while (tok && ++guard < 8);
    return tok ? null : files;
  }

  // The tick. Returns a one-word verdict so the tests (and the console) can
  // see exactly which rule decided. `why` names what woke it.
  async function _pinWatchTick(why) {
    var screen = _pinWatchScreen();
    if (!screen) return 'off screen';
    var hold = _pinWatchHold();
    if (hold) return hold;
    if (_pinWatchBusy) return 'already looking';
    _pinWatchBusy = true;
    _pinWatchLastAt = Date.now();
    try {
      var files = await _pinWatchProbe();
      _pinWatchRetried = false;            // Drive answered: the quick-retry latch re-arms
      if (!files) return 'folder too big';
      var sig = _pinWatchSigOf(files);
      if (PIN._pinWatchSig === null) { PIN._pinWatchSig = sig; return 'baseline'; }
      if (sig === PIN._pinWatchSig) return 'same';
      // Drive moved on since the screen was drawn. Ask again before acting —
      // the user may have opened a card while Drive was answering. Held now
      // means the baseline stays unmatched, so the next idle tick reloads.
      hold = _pinWatchHold();
      if (hold) { console.log('[inbox watch] change seen, holding (' + hold + ')'); return 'held'; }
      if (screen === 'inbox') {
        console.log('[inbox watch] inbox changed on another device (' + why + ') — reloading');
        await window._pinRefresh();        // takes the new baseline from its own complete listing
      } else {
        console.log('[inbox watch] inbox changed on another device (' + why + ') — updating the dashboard card');
        PIN._pinWatchSig = sig;
        _navBadge(files.length);
        try { _pinPanelFill(); } catch (eP) {}
      }
      return 'reloaded';
    } catch (e) {
      // v0.9.1705: measured 2026-09-09 — the first look after a tab was hidden
      // for half an hour failed because the sign-in token was mid-renewal
      // (401 → refresh), and the change waited for the next minute tick. One
      // quick retry covers that; a persistent fault falls back to the timer.
      console.warn('[inbox watch] look failed:', e && e.message);
      if (!_pinWatchRetried) { _pinWatchRetried = true; _pinWatchSoon('retry', _WATCH_RETRY_MS); }
      return 'error';
    } finally { _pinWatchBusy = false; }
  }
  // Event-driven looks (tab shown, window focused, card closed) are cheap but
  // arrive in clusters; one look per few seconds is plenty.
  function _pinWatchSoon(why, delayMs) {
    setTimeout(function () {
      if (Date.now() - _pinWatchLastAt < _WATCH_EVENT_GAP_MS) return;
      _pinWatchTick(why);
    }, delayMs || 800);
  }
  function _pinWatchStart() {
    if (_pinWatchTimer || window.IS_MOBILE_UA) return;   // rule 3: phones never poll
    _pinWatchTimer = setInterval(function () { _pinWatchTick('timer'); }, _WATCH_MS);
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') _pinWatchSoon('tab shown', 1200);
      });
      window.addEventListener('focus', function () { _pinWatchSoon('window focused', 800); });
    } catch (e) {}
  }
  window._pinWatchTick = _pinWatchTick;   // for the tests and the console; not a UI hook
  // (→ app/photo-inbox-grid.js, split step 6: moved word for word.)
  // (→ app/photo-inbox-offline.js, split step 8: moved word for word.)

  // ── Review a photo group: research laid out → Add / Research /
  //    Discard (v0.9.888, Brad's flow). Also handles "Combine → one
  //    item…" for a multi-selection (all selected photos = one item).
  PIN._rvGroups = [];

  // v0.9.941 (Brad's Marx girder bridge): the number lookup must respect the
  // manufacturer the photo-read reported. '1303' exists under Atlas O, but the
  // AI said Marx — matching by number alone showed 'Maker: Atlas'. Prefer a
  // catalog row whose brand agrees with the AI; if none agrees, keep the
  // number match but flag the conflict instead of presenting it as fact.
  function _pinMfrAgree(a, b) {
    a = String(a || '').toLowerCase().trim(); b = String(b || '').toLowerCase().trim();
    if (!a || !b) return true;   // nothing to compare -> no conflict
    var aw = a.split(/\s+/)[0], bw = b.split(/\s+/)[0];
    return a.indexOf(bw) >= 0 || b.indexOf(aw) >= 0;
  }
  // v0.9.1066 (Brad: "we still are not using the manufacturer and era when
  // id'ing them ... all my pictures are lionel postwar and i got atlas and
  // prewar matches"). He was right, and the era work so far had missed the one
  // path that actually produces what he SEES. v0.9.1063 handed the era stamp to
  // the OCR-text step; this function — the one that turns a number into the
  // Maker / Item # / Description panel — never received it. When the reader
  // gives no manufacturer of its own (a free OCR read never does), the last
  // line here was `return bucket[0]`: whichever catalog happened to load first.
  // A postwar-stamped photo of a 6817 flatcar therefore resolved to Lionel
  // PRE-WAR 58, "Lamp Post, 7 3/8 high".
  // v0.9.1119 (Brad's 2338): promo, paper, display and set rows are real
  // catalog rows, but they must never WIN a plain number lookup while an
  // actual item row with the same number exists — the Nabisco Train-O-Rama's
  // 2338 was outranking the GP-7 locomotive itself purely by load order.
  // Word boundaries keep this away from "Boxcar" and friends.
  function _pinDemotedRow(row) {
    if (!row) return false;
    if (_pinIsSetRow(row)) return true;
    return /\b(promo|promotional|paper|boxes|catalog|catalogs|display|displays|instruction|instructions)\b/i
      .test(String(row.itemType || '') + ' ' + String(row._tab || ''));
  }
  // v0.9.1120: browse.js consults the same rule when deciding which catalog
  // row an owned item lights up — one definition, shared everywhere.
  window.rrDemotedRow = _pinDemotedRow;

  // ── v0.9.1371, rehomed in v0.9.1372 ──────────────────────────────────────
  // Brad's 6436-110. The reader gets 6436; the catalogue has no plain 6436,
  // only 6436-1/-25/-110/-500/-1969. _pinBestMaster asks for the exact number,
  // got nothing, and the inbox announced "6436 isn't in the catalog" while
  // fourteen real rows sat there.
  //
  // The finder itself now lives ONCE, in app.js as rrDashedKin, because the
  // wizard needs the same answer for Brad's green 3376-160. This is a call,
  // not a copy — the duplicate that used to live here is deleted.
  function _pinDashedKin(num) {
    return (typeof rrDashedKin === 'function') ? rrDashedKin(num) : [];
  }

  // v0.9.1735 — the row the user pointed at. Matched on road + description,
  // never on position, and scoped to the eras the photo is tagged with so a
  // pick cannot drag in another catalog's row that happens to share the name.
  function _pinPickedRow(num, pick, prefer) {
    if (!pick) return null;
    var bucket = [];
    try {
      bucket = (typeof window._mbAllGet === 'function')
        ? (window._mbAllGet(String(num).trim()) || [])
        : ((window.state && state.masterByItem && state.masterByItem.get) ? (state.masterByItem.get(String(num).trim()) || []) : []);
    } catch (e) { return null; }
    var eras = _prefEras(prefer);
    var want = (String(pick.road || '') + '|' + String(pick.desc || '')).toUpperCase();
    var hit = null;
    for (var i = 0; i < bucket.length; i++) {
      var r = bucket[i];
      if (!r) continue;
      if (eras.length && eras.indexOf(r._era) < 0) continue;
      var idk = (String(r.roadName || '') + '|' + String(r.description || '')).toUpperCase();
      if (idk === want) { hit = r; break; }
      if (!hit && pick.road && String(r.roadName || '').toUpperCase() === String(pick.road).toUpperCase()) hit = r;
    }
    return hit;
  }

  function _pinBestMaster(num, aiMfr, prefer, srcText) {
    var bucket = null;
    // v0.9.971 (Brad): _mbAllGet = the ONE shared bucket lookup (loaded eras +
    // the full-catalog index), so the inbox sees MTH/Atlas/etc. like Research does.
    try {
      bucket = (typeof window._mbAllGet === 'function')
        ? window._mbAllGet(String(num).trim())
        : ((window.state && state.masterByItem && state.masterByItem.get) ? state.masterByItem.get(String(num).trim()) : null);
    } catch (e) {}
    if (bucket && bucket.length) {
      // v0.9.1119: demoted rows (promo/paper/display/set) go to the BACK of
      // the line before any selection runs, so every rule below — maker
      // match, era match, load-order fallback — naturally prefers a real
      // item row. Relative order inside each class is untouched, and a
      // demoted row still wins when it is the only kind there is.
      try {
        var _keep = [], _demo = [];
        for (var b0 = 0; b0 < bucket.length; b0++) (_pinDemotedRow(bucket[b0]) ? _demo : _keep).push(bucket[b0]);
        if (_keep.length && _demo.length) bucket = _keep.concat(_demo);
      } catch (e0) {}
      // v0.9.1297 (Brad: "the photo reader needs to use the type as a helper
      // to decide what it is"): rows whose itemType matches the photo's Type
      // tag float to the FRONT — a soft rank, like the demotion above, so the
      // maker/era rules below still win outright and a type-mismatched row
      // still surfaces when it is all there is. A photo tagged Boxcar stops
      // resolving to the paper row that shares its number.
      try {
        var _pt = (prefer && prefer.type) ? String(prefer.type).toLowerCase() : '';
        if (_pt && bucket.length > 1) {
          var _tm = [], _tn = [];
          for (var t0 = 0; t0 < bucket.length; t0++) {
            var _it = String(bucket[t0].itemType || '').toLowerCase();
            (_it && (_it.indexOf(_pt) >= 0 || _pt.indexOf(_it) >= 0) ? _tm : _tn).push(bucket[t0]);
          }
          if (_tm.length && _tn.length) bucket = _tm.concat(_tn);
        }
      } catch (eT) {}
      // v0.9.1504 (task #29): a maker-less tag still steers — rows matching
      // the photo's period and scale float to the FRONT. A soft rank, same
      // shape as the type rank above: the maker/era rules below still win
      // outright, and a mismatched row still surfaces when it is all there is.
      try {
        var _pp = (prefer && prefer.period) ? String(prefer.period) : '';   // v0.9.1505: ranks within a span-era too
        var _ps = (prefer && !prefer.era && !(prefer.eras && prefer.eras.length) && prefer.scale) ? String(prefer.scale) : '';
        if ((_pp || _ps) && bucket.length > 1) {
          var _pm = [], _pn = [];
          for (var p0 = 0; p0 < bucket.length; p0++) {
            var _r9 = bucket[p0], _ok9 = true;
            if (_pp) {
              var _rp9 = '';
              try { _rp9 = (typeof _wizPeriodOfRow === 'function') ? (_wizPeriodOfRow(_r9) || '') : ((typeof _itemEraPeriod === 'function') ? (_itemEraPeriod(_r9) || '') : ''); } catch (e91) {}
              if (_rp9 && _rp9 !== _pp) _ok9 = false;
            }
            if (_ok9 && _ps) {
              var _rs9 = String(_r9.gauge || ((typeof ERA_SCALE !== 'undefined' && _r9._era) ? (ERA_SCALE[_r9._era] || '') : '') || '');
              var _ms9 = false;
              try { _ms9 = ((typeof ERA_SCALES_MULTI !== 'undefined' && _r9._era && ERA_SCALES_MULTI[_r9._era]) || []).some(function (s9) { return (typeof rrSameScale === 'function') ? rrSameScale(s9, _ps) : String(s9).toUpperCase() === _ps.toUpperCase(); }); } catch (e92) {}
              if (_rs9 && !_ms9 && !((typeof rrSameScale === 'function') ? rrSameScale(_rs9, _ps) : _rs9.toUpperCase() === _ps.toUpperCase())) _ok9 = false;
            }
            (_ok9 ? _pm : _pn).push(_r9);
          }
          if (_pm.length && _pn.length) bucket = _pm.concat(_pn);
        }
      } catch (eP9) {}
      // v0.9.1734 — THE WORDS ON THE CAR, ranked LAST of the soft ranks so it
      // dominates them. Brad's 6050 is nine Lionel Postwar Boxcars; type,
      // period and scale all tie, and the hard rules below take the FIRST
      // in-era row, so load order was the whole decision. It is not evidence.
      // The photo said SAVINGS and BANK.
      //
      // Still a soft rank, not a return: an explicit maker or era statement
      // below must keep beating it, because the user saying "this is Lionel
      // Postwar" outranks a word that happened to appear in OCR noise.
      try {
        if (srcText && bucket.length > 1) {
          var _wm = _pinRowFromWords(bucket, srcText);
          if (_wm && _wm.row) {
            var _wi = bucket.indexOf(_wm.row);
            if (_wi > 0) bucket = [_wm.row].concat(bucket.slice(0, _wi), bucket.slice(_wi + 1));
          }
        }
      } catch (eW9) {}
      // What the reader claims to have seen still wins — it looked at the item.
      if (aiMfr) {
        for (var i = 0; i < bucket.length; i++) {
          var mk = bucket[i].manufacturer || ((typeof ERAS !== 'undefined' && ERAS[bucket[i]._era]) ? ERAS[bucket[i]._era].manufacturer : '');
          if (_pinMfrAgree(aiMfr, mk)) return bucket[i];
        }
      }
      // Then what the PHOTO says it is. An exact era beats a maker match, which
      // beats load order — and load order is what this used to be.
      if (prefer && (prefer.era || prefer.manufacturer)) {
        // v0.9.1089: an in-era row that QUOTES this number beats an off-era row
        // that carries it — typing 6817 on a Modern-tagged card should land on
        // the Modern reissue, because the tag settles it.
        // v0.9.1167: the era SET, so a multi-era filter still gets an exact hit.
        var _bmEras = _prefEras(prefer);
        try {
          var hasExact = bucket.some(function (r) { return _bmEras.indexOf(r._era) >= 0; });
          if (_bmEras.length && !hasExact) {
            var qm3 = _pinQuoteMatch(String(num).trim(), prefer);
            if (qm3 && qm3.row) return qm3.row;
          }
        } catch (eQ) {}
        var exact = null, byMaker = null;
        for (var j = 0; j < bucket.length; j++) {
          var row = bucket[j];
          if (_bmEras.length && _bmEras.indexOf(row._era) >= 0) { exact = row; break; }
          if (!byMaker && prefer.manufacturer) {
            var mk2 = row.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[row._era]) ? ERAS[row._era].manufacturer : '');
            if (_pinMfrAgree(prefer.manufacturer, mk2)) byMaker = row;
          }
        }
        if (exact) return exact;
        if (byMaker) return byMaker;
        // v0.9.1167 (Brad: "if i once again tell you its a lionel, don't suggest
        // to me atlas"). THIS is the line that put Atlas on his card. The free
        // reader offered a bare catalog-shaped token — 2500 off an MKT locomotive,
        // 40200 off a gondola's LT WT stamp — and this dressed it in whatever
        // maker happened to own that number, falling through to bucket[0].
        //
        // When the filter names a maker and nothing in this bucket IS that maker,
        // the honest answer is none: "we read 2500 and it is not in your Lionel
        // list". Another maker's row that shares the digits is a coincidence, not
        // an identification, and presenting it as one is what made him ask what
        // the hell was going on.
        if (prefer.manufacturer) return null;
      }
      return bucket[0];
    }
    try { return (typeof findMaster === 'function') ? findMaster(num, null, prefer || null) : null; } catch (e) { return null; }
  }
  // v0.9.1734 — the TEXT read off the photo currently open in the review card.
  // Sits beside _rvPrefer because it answers the same shape of question ("what
  // does this photo tell us?") and both default into _pinLookup. Free reads
  // store `raw`; a paid read stores `aiRaw`; either will do, and a photo with
  // neither simply gets no word evidence.
  function _rvReadText() {
    try {
      var fid = (PIN._rvGroups && PIN._rvGroups.length) ? _pinReadFid(PIN._rvGroups[0]) : '';
      if (!fid) return '';
      var rec = _ids()[fid];
      if (rec && typeof rec === 'object' && (rec.raw || rec.aiRaw)) return String(rec.raw || rec.aiRaw);
      var f = _freeTried()[fid];
      return (f && typeof f === 'object' && f.raw) ? String(f.raw) : '';
    } catch (e) { return ''; }
  }
  // The era stamped on the photo currently open in the review card.
  function _rvPrefer() {
    try { return (PIN._rvGroups && PIN._rvGroups.length) ? _pinPreferOf(PIN._rvGroups[0]) : null; }
    catch (e) { return null; }
  }

  // ── v0.9.1419 (Cooper's Big Boy) — does the row match the PHOTO? ────────
  // The reader described a Union Pacific 4-8-8-4 Big Boy, attached "No.
  // 6-11122" from its own memory (its notes say no printed number came back),
  // and 6-11122 in the catalog is a Southern 0-8-0 with TrainSounds. The app
  // showed both side by side and never compared them: "the number exists in
  // the catalog" was being treated as "the number is right".
  //
  // This asks the narrow question with the strongest signals a model train
  // offers, and stays silent otherwise:
  //   · wheel arrangement — 4-8-8-4 cannot be 0-8-0. The pattern needs at
  //     least two hyphens and small numbers, which keeps catalog numbers like
  //     6464-275 from ever reading as wheels.
  //   · railroad — flagged only when BOTH sides name one and NEITHER name
  //     appears anywhere in the other's full text, so "New York Central" vs
  //     "NYC Hudson" never false-alarms on abbreviation.
  // Returns a plain-English reason, or '' for "no quarrel".
  function _pinAiRowConflict(ai, aiText, row) {
    if (!row) return '';
    var norm = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, ' '); };
    var aiFull  = norm([ai && ai.roadName, ai && ai.description, ai && ai.subType, aiText].filter(Boolean).join(' '));
    var rowFull = norm([row.roadName, row.description, row.itemType].filter(Boolean).join(' '));
    if (!aiFull.trim() || !rowFull.trim()) return '';
    var wheels = function (s) {
      return (s.match(/\b\d{1,2}(?:-\d{1,2}){2,3}\b/g) || []).filter(function (w) {
        return w.split('-').every(function (d) { return +d <= 16; });
      });
    };
    var wA = wheels(aiFull), wR = wheels(rowFull);
    if (wA.length && wR.length && !wA.some(function (w) { return wR.indexOf(w) >= 0; })) {
      return 'the photo shows a ' + wA[0] + ' but this number’s catalog entry is a ' + wR[0];
    }
    var toks = function (s) {
      return norm(s).split(/\s+/).filter(function (t) {
        return t.length >= 3 && !/^(THE|AND|LINE|LINES|RAIL|ROAD|RAILROAD|RAILWAY|SYSTEM|CO)$/.test(t);
      });
    };
    var tA = toks((ai && ai.roadName) || ''), tR = toks(row.roadName || '');
    if (tA.length && tR.length) {
      var cross = tA.some(function (t) { return rowFull.indexOf(t) >= 0; })
               || tR.some(function (t) { return aiFull.indexOf(t) >= 0; });
      // "New York Central" and "NYC" are the same railroad wearing different
      // lengths. If either side's initials spell the other side's name, they
      // agree — checked on the FULL word list (norm keeps 2-letter tokens the
      // >= 3 filter above drops, so B&O → "B O" still initials to BO).
      if (!cross) {
        var initials = function (s) {
          return norm(s).split(/\s+/).filter(Boolean).map(function (t) { return t[0]; }).join('');
        };
        var iA = initials((ai && ai.roadName) || ''), iR = initials(row.roadName || '');
        var flat = function (s) { return norm(s).replace(/[\s-]+/g, ''); };
        if ((iA.length >= 2 && flat(row.roadName).indexOf(iA) >= 0)
         || (iR.length >= 2 && flat((ai && ai.roadName) || '').indexOf(iR) >= 0)) cross = true;
      }
      if (!cross) {
        return 'the photo says ' + String(ai.roadName) + ' but this number’s catalog entry is ' + String(row.roadName);
      }
    }
    return '';
  }

  function _pinLookup(num, aiMfr, prefer, srcText) {
    num = String(num || '').trim();
    var out = { num: num, master: null, ownedPd: null, maker: '', era: '', desc: '', mfrMismatch: '' };
    if (!num) return out;
    // Default to the era stamped on the photo being reviewed, so every caller
    // gets it without having to remember to pass it.
    if (prefer === undefined) prefer = _rvPrefer();
    // v0.9.1734: and default to the READ TEXT of the photo being reviewed, for
    // the same reason — the free reader has stored it per file since v0.9.1068,
    // and it is the only thing that can separate nine rows sharing one number.
    if (srcText === undefined) srcText = _rvReadText();
    out.master = _pinBestMaster(num, aiMfr, prefer, srcText);
    // v0.9.1735: the user has pointed at one of the rows under this number.
    // That is not evidence to be weighed against OCR words and load order - it
    // is a person telling the app which car they are holding, so it wins
    // outright. Guarded by the number so a pick can never survive onto a
    // different one.
    try {
      if (PIN._rvPickedId && String(PIN._rvPickedId.num) === num) {
        var _rp = _pinPickedRow(num, PIN._rvPickedId, prefer);
        if (_rp) out.master = _rp;
      }
    } catch (ePK) {}
    if (out.master) {
      var m = out.master;
      var eraDef = (typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era] : null;
      out.maker = m.manufacturer || (eraDef ? eraDef.manufacturer : '') || '';
      out.era = eraDef ? eraDef.label : '';
      out.desc = m.description || [m.roadName, m.itemType].filter(Boolean).join(' ') || '';
      if (aiMfr && !_pinMfrAgree(aiMfr, out.maker)) out.mfrMismatch = String(aiMfr);
    }
    // v0.9.1045 (Brad's 213): this used to match on the number alone, so a
    // prewar 213 in the collection was reported as "you already own" a postwar
    // 213. rrFindOwnedCopy compares era and manufacturer as well and says
    // whether the copy you own is actually the same item.
    var _own = (typeof rrFindOwnedCopy === 'function') ? rrFindOwnedCopy(num, out.master) : null;
    if (_own) {
      out.ownedPd = _own.pd;
      out.ownedAgrees = _own.agrees;      // false = same number, different item
      out.ownedLabel = _own.label;
    } else {
      var pds = Object.values((window.state || {}).personalData || {});
      out.ownedPd = pds.find(function (p) { return p && p.owned && String(p.itemNum) === num; }) || null;
      out.ownedAgrees = true;
    }
    return out;
  }

  // ══ v0.9.1294 (Brad, request #30): the excluded numbers live ON THE CARD ══
  // "need to move the numbers excluded from previous scan to here, have each
  //  number where you can check or uncheck it to exclude it. Then add a note
  //  that says, if still wrong hit the rescan button below."
  //
  // v0.9.1277 made rejections visible; this puts them where he is already
  // looking — the result card — with one checkbox per number instead of the
  // old all-or-nothing clear (_pinUnreject, removed). Checked = still
  // excluded. Un-checking edits the stored mark list ONLY: the re-scan
  // happens when the re-scan button is pressed (Brad's choice, 2026-08-03),
  // so several marks can be fixed before one re-scan. The view keeps
  // just-unchecked numbers on screen (checkbox empty) so a mis-click can be
  // re-checked right up until the card is rebuilt.
  var _exclView = { fid: null, nums: [] };
  function _pinExcludedHtml() {
    var fid = '', stored = [];
    try {
      fid = _pinOnScreenFid();
      var e = _ids()[fid];
      stored = (e && Array.isArray(e.rejected)) ? e.rejected.slice() : [];
    } catch (e2) {}
    if (_exclView.fid !== fid) _exclView = { fid: fid, nums: stored.slice() };
    else stored.forEach(function (n) { if (_exclView.nums.indexOf(n) < 0) _exclView.nums.push(n); });
    if (!_exclView.nums.length) return '';
    // v0.9.1739: folded shut by default. It is needed one time in twenty and
    // was spending its height every time; the count in the summary says all
    // that matters at a glance, and one tap opens the checkboxes.
    return '<details id="pin-rv-excl" style="margin-top:0.55rem;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:9px;background:var(--surface2)">'
      + '<summary style="font-size:0.7rem;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:var(--text-dim);cursor:pointer">' + _exclView.nums.length + ' number' + (_exclView.nums.length === 1 ? '' : 's') + ' excluded from earlier scans</summary>'
      + '<div style="margin-top:0.35rem">'
      + _exclView.nums.map(function (n, i) {
          var on = stored.indexOf(n) >= 0;
          return '<label style="display:inline-flex;align-items:center;gap:0.35rem;margin:0 0.75rem 0.3rem 0;font-size:0.82rem;color:var(--text);cursor:pointer">'
            + '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="_pinRejectToggle(' + i + ', this.checked)" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer">'
            + rrEsc(n) + '</label>';
        }).join('')
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">Checked numbers are left out of the scan. Un-check one to allow it again — if the answer is still wrong, hit the re-scan button below.</div>'
      + '</div></details>';
  }
  // The checkbox handler edits ONE mark and never re-scans — the re-scan
  // button below the card is the trigger. The index points into
  // _exclView.nums, so no number string ever rides through an HTML attribute.
  window._pinRejectToggle = function (i, checked) {
    var n = _exclView.nums[i];
    if (n === undefined) return;
    try {
      var fid = _exclView.fid || _pinOnScreenFid();
      var m = _ids();
      var e = m[fid] || (m[fid] = {});
      var list = Array.isArray(e.rejected) ? e.rejected : [];
      var at = list.indexOf(n);
      if (checked && at < 0) list.push(n);
      if (!checked && at >= 0) list.splice(at, 1);
      if (list.length) e.rejected = list;
      else delete e.rejected;
      _idsSave(m);
    } catch (e2) {}
  };

  PIN._rvAiMfr = '';
  PIN._rvAiRec = null;   // v0.9.1419: the WHOLE read for the photo on screen, not just the maker
  window._pinReviewLookup = function (val) {
    var box = document.getElementById('pin-rv-info');
    var addBtn = document.getElementById('pin-rv-add');
    if (!box) return;
    var lk = _pinLookup(val, PIN._rvAiMfr);
    // v0.9.963 (Brad): bigger, readable catalog details at the top of the card.
    var row = function (label, v) {
      return '<div style="display:flex;gap:0.6rem;font-size:0.95rem;line-height:1.55"><span style="width:92px;flex-shrink:0;color:var(--text-dim)">' + label + '</span><span style="color:var(--text);font-weight:600">' + (v || '—') + '</span></div>';
    };
    var html = '';
    if (!lk.num) {
      var _fi = _pinFailInfo();
      html = '<div style="font-size:0.9rem;color:var(--text-dim)">No number picked up automatically — type it below if you can see it, or use Research.</div>'
        + (_fi ? _pinWhyHtml(_fi.raw, _fi.dbg, null) : '');
    } else if (lk.master && lk.mfrMismatch) {
      html = '<div style="font-size:0.82rem;color:var(--t-gold);font-weight:700;line-height:1.5;margin-bottom:0.35rem">⚠ The photo says ' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' — but #' + String(lk.num).replace(/</g, '&lt;') + ' in the catalog is a ' + String(lk.maker || '?').replace(/</g, '&lt;') + ' item. Probably NOT the same thing.</div>'
        + row('Catalog has', (lk.maker || '—') + ': ' + String(lk.desc).replace(/</g, '&lt;'))
        + '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' isn\'t in the master catalog' + ((typeof state !== 'undefined' && state.masterData && state.masterData.some(function (it) { return _pinMfrAgree(lk.mfrMismatch, it.manufacturer || ''); })) ? ' under this number' : ' yet') + ' — Add will create a manual ' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' entry instead of the ' + String(lk.maker || '').replace(/</g, '&lt;') + ' item.</div>';
    } else if (lk.master) {
      html = row('Maker', (lk.maker || '—') + (lk.era ? ' <span style="font-weight:400;color:var(--text-dim)">(' + lk.era + ')</span>' : ''))
        + row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + row('Description', String(lk.desc).replace(/</g, '&lt;'));
      // ── v0.9.1419 (Cooper's Big Boy) — the number resolved, but does the
      // row it resolved TO match the photo? The maker check above only catches
      // cross-brand mistakes; 6-11122 was Lionel-vs-Lionel and sailed through
      // with a Southern 0-8-0 sitting beside a Big Boy read. When the row and
      // the read disagree, say so — and since the catalog is already loaded,
      // search it BY THE READER'S WORDS (Brad's idea) and offer what actually
      // matches the photo as a tap, through the same _pinDescMatch the rescue
      // chain already trusts.
      try {
        if (PIN._rvAiRec) {
          var _cfAi = { roadName: PIN._rvAiRec.road, description: PIN._rvAiRec.desc, subType: PIN._rvAiRec.subType };
          var _cf = _pinAiRowConflict(_cfAi, PIN._rvAiRec.aiRaw || '', lk.master);
          if (_cf) {
            html = '<div style="font-size:0.82rem;color:var(--t-gold);font-weight:700;line-height:1.5;margin-bottom:0.35rem">'
              + '⚠ This number may be wrong — ' + rrEsc(_cf) + '. Probably NOT the same thing.</div>' + html;
            var _dm = null;
            try { _dm = _pinDescMatch(PIN._rvAiRec.aiRaw || PIN._rvAiRec.desc || '', _rvPrefer()); } catch (eDm) {}
            if (_dm && _dm.row && _dm.row.itemNum && String(_dm.row.itemNum) !== String(lk.num)
                && !_pinAiRowConflict(_cfAi, PIN._rvAiRec.aiRaw || '', _dm.row)) {
              var _dmDesc = [_dm.row.roadName, _dm.row.description].filter(Boolean).join(' — ').slice(0, 80);
              html += '<div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">'
                + '<span style="font-size:0.76rem;color:var(--text-dim)">This catalog entry DOES match the photo:</span>'
                + '<button onclick="_pinPickNum(\'' + rrEsc(String(_dm.row.itemNum)).replace(/'/g, '') + '\')" '
                + 'style="padding:0.4rem 0.8rem;border-radius:999px;border:1.5px solid #2ecc71;'
                + 'background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 12%, var(--bg-card));color:var(--t-green);'
                + 'font-family:var(--font-body);font-weight:700;font-size:0.82rem;min-height:38px;cursor:pointer">'
                + rrEsc(String(_dm.row.itemNum)) + ' — ' + rrEsc(_dmDesc) + '</button>'
                + '</div>';
            } else {
              html += '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.4rem">'
                + 'Nothing in the catalog matches the photo’s description either — check the number printed on the item or its box.</div>';
            }
          }
        }
      } catch (eCf) {}
    } else {
      html = row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">Not found in the catalog — you can still add it, or Research to double-check the number.</div>';
    }
    // v0.9.1431 (Brad): the one-line notice is now the full owned-copies
    // list — every copy, its variation # and condition, each clickable to its
    // detail page. Same list as the wizard's "You have this item" panel
    // (_rrOwnedPanelHtml in wizard.js); rows route through _pinSeeOwned so
    // the review card hides rather than closes. The amber same-number-
    // different-item warning stays — it has caught real prewar/postwar
    // collisions before (v0.9.1045, Brad's 213).
    if (lk.ownedPd && lk.ownedAgrees === false) {
      html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:var(--t-gold);font-weight:700;line-height:1.5">You own a '
        + rrEsc(lk.ownedLabel) + ' \u2014 same number, different item. This one is new to your collection.'
        + _pinSeeItLink(lk.ownedPd) + '</div>';
    }
    var _ownAll = (typeof rrOwnedCopies === 'function') ? rrOwnedCopies(lk.num) : [];
    if (_ownAll.length && typeof _rrOwnedPanelHtml === 'function') {
      html += '<div style="margin-top:0.45rem">' + _rrOwnedPanelHtml(_ownAll, 'pin') + '</div>';
    } else if (lk.ownedPd && lk.ownedAgrees !== false) {
      html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:var(--t-green);font-weight:700">\u2713 You already own one — this will be added as a separate copy.'
        + _pinSeeItLink(lk.ownedPd) + '</div>';
    }
    // v0.9.1444: the dashed family, whenever one exists — not only when the
    // number is missing from the catalogue (see _pinKinPanelHtml).
    try {
      // v0.9.1832: the read's alternatives ride along — for a family read
      // they are the relatives the words narrowed it to, and the panel lists
      // those first. _rvAiRec is the ONE record the card resolved (v1096).
      var _rdAlts = (PIN._rvAiRec && Array.isArray(PIN._rvAiRec.alts)) ? PIN._rvAiRec.alts : [];
      var _kinHtml = _pinKinPanelHtml(lk.num, lk.master, _rdAlts);
      if (_kinHtml) html += _kinHtml;
    } catch (eKin) {}
    // v0.9.1294 (request #30): the excluded numbers ride on EVERY branch of
    // the card — a failed read with exclusions is exactly the case where the
    // right answer is sitting on the excluded list.
    box.innerHTML = html + _pinExcludedHtml();
    // v0.9.942 (Identify v3, Brad): double-check the photo against the
    // catalog listing's reference photo when the matched master row links one.
    try { _pinVerifyRender(lk); } catch (eV) {}
  };

  // ── "See it here." (v0.9.1235) ────────────────────────────────────────
  // Brad: "have a clickable text at the end of that sentence that says,
  // 'See it here.'"
  //
  // Being told you already own one raises exactly one question — WHICH one —
  // and until now the only way to answer it was to abandon the review, go to
  // My Collection and search. The link goes straight to that copy.
  //
  // It is keyed on the inventoryId, never the item number: the whole point of
  // the sentence is that a number can name more than one thing, and two
  // sentences up we say so. Without an inventoryId there is no link, because
  // a link that opens the wrong copy is worse than no link on a message
  // specifically about telling copies apart.
  //
  // It HIDES the review rather than closing it, and floats a way back — the
  // same shape as _wizPeekDetail, for the same reason. A half-reviewed photo
  // is work in progress and must survive the round trip.
  function _pinSeeItLink(pd) {
    var id = (pd && pd.inventoryId) ? String(pd.inventoryId) : '';
    if (!id) return '';
    return ' <a href="javascript:void 0" onclick="window._pinSeeOwned(\'' + rrEsc(id) + '\');return false"'
      + ' style="color:var(--accent2);text-decoration:underline;font-weight:700;cursor:pointer">See it here.</a>';
  }

  window._pinSeeOwned = function (invId) {
    try {
      if (!invId) return;
      var ov = document.getElementById('pin-review-ov');
      if (ov) ov.style.display = 'none';        // hide only — the review is still in progress
      var old = document.getElementById('pin-owned-pill');
      if (old) old.remove();
      var pill = document.createElement('button');
      pill.id = 'pin-owned-pill';
      pill.innerHTML = '\u2190 Back to your photo';
      pill.style.cssText = 'position:fixed;bottom:1.1rem;left:50%;transform:translateX(-50%);'
        + 'z-index:8000;padding:0.7rem 1.3rem;border-radius:999px;border:none;'
        + 'background:var(--accent);color:var(--cream);font-weight:700;font-size:0.9rem;'
        + 'cursor:pointer;box-shadow:0 4px 18px var(--scrim);font-family:var(--font-body)';
      pill.onclick = function () {
        pill.remove();
        // v0.9.1495 (Brad: "if you hit back to your photo, the photo inbox
        // doesn't reappear, it stays on the detail page"): return the PAGE
        // first, then the card — the card floats over whatever page is
        // current, and it was floating over the detail page (and rendering
        // askew there).
        try { if (typeof showPage === 'function') showPage('photo-inbox'); } catch (eP) {}
        var o = document.getElementById('pin-review-ov');
        if (o) o.style.display = '';
      };
      document.body.appendChild(pill);
      if (typeof _openOwnedByInvId === 'function') _openOwnedByInvId(invId);
      else if (typeof goToMyCollection === 'function') goToMyCollection();
    } catch (e) { console.warn('[see it here]', e); }
  };

  // ── Identify v3 (v0.9.942): photo double-check vs the catalog photo ──────
  // Auto-runs when the AI's answer was a best guess (or brand-mismatched);
  // otherwise offers a button. Verdicts cache per (photo, number) so repeat
  // opens are free; the relay also caches server-side.
  var _vfCache = {};   // fid|num -> aiVerifyPhoto result
  var _vfSeen  = {};   // fid|num -> 1 once auto-run fired (no repeat burns)
  PIN._vfNote  = {};   // group key -> rejection note for the re-identify run
  function _pinVerifyRender(lk) {
    var box = document.getElementById('pin-rv-info');
    if (!box || !PIN._rvGroups || !PIN._rvGroups.length || !lk) return;
    var link = (lk.master && (lk.master.refLink || '')) || '';
    if (!lk.num || !/^https?:\/\//i.test(link)) return;
    if (typeof aiVerifyPhoto !== 'function') return;
    if (!_pinAr()) return;   // v0.9.1927: the double-check is a paid read — beta feature
    var fid0 = PIN._rvGroups[0].files[0].id;
    var key = fid0 + '|' + lk.num;
    var el = document.createElement('div');
    el.id = 'pin-rv-verify';
    el.style.cssText = 'margin-top:0.5rem;padding-top:0.45rem;border-top:1px dashed var(--border)';
    box.appendChild(el);
    if (_vfCache[key]) { _pinVerifyShow(el, _vfCache[key]); return; }
    // v0.9.1263 (finding R4): the double-check is a metered read. ai-id.js now
    // refuses it when the user has switched reads off — but offering a button
    // that cannot work, and answering it with "switched off", is the same dead
    // end that sent Brad hunting a fault in v0.9.1163. Say so up front instead,
    // and never auto-run. An already-cached verdict still shows: it was paid
    // for before the switch was thrown and costs nothing to display.
    if (typeof rrAiOptedOut === 'function' && rrAiOptedOut()) {
      el.innerHTML = '<div style="font-size:0.78rem;color:var(--warn)">'
        + '📷 Double-check vs the catalog photo uses a photo ID read — '
        + 'reads are switched off in Preferences › Photo ID</div>';
      return;
    }
    var s0 = null; try { s0 = _ids()[fid0]; } catch (eS) {}
    var auto = !!(s0 && s0.num && String(s0.num) === String(lk.num) && (s0.guess || lk.mfrMismatch));
    if (auto && !_vfSeen[key]) {
      _vfSeen[key] = 1;
      _pinVerifyRun(lk, key, el);
    } else {
      el.innerHTML = '<button onclick="_pinVerifyClick()" style="padding:0.4rem 0.7rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link);font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">📷 Double-check vs catalog photo</button>';
    }
  }
  window._pinVerifyClick = function () {
    var num = (document.getElementById('pin-rv-num') || {}).value || '';
    var lk = _pinLookup(num, PIN._rvAiMfr);
    var el = document.getElementById('pin-rv-verify');
    if (!el || !PIN._rvGroups || !PIN._rvGroups.length || !lk.master) return;
    _pinVerifyRun(lk, PIN._rvGroups[0].files[0].id + '|' + lk.num, el);
  };
  async function _pinVerifyRun(lk, key, el) {
    el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim)">📷 Checking your photo against the catalog listing…</div>';
    var vr;
    try {
      var blob = await _pinBytes(PIN._rvGroups[0].files[0].id);
      // v0.9.1018: COTT links get the item's #anchor so the relay pulls THIS
      // item's photo off the multi-item page (was: page's first image).
      var _vrRef = lk.master.refLink;
      try { if (_vrRef && typeof window.cottAnchorUrl === 'function') _vrRef = window.cottAnchorUrl(_vrRef, lk.master.itemNum, window.cottRowWords ? window.cottRowWords(lk.master) : '', lk.master.variation || ''); } catch (eA) {}
      vr = await aiVerifyPhoto(blob, _vrRef);
    } catch (e) {
      console.warn('[Inbox] verify failed:', e && e.message);
      vr = { ok: false, reason: 'error' };
    }
    // v0.9.1180: carry the page we tried, so a failure can offer to open it.
    try { if (vr && typeof vr === 'object') vr._ref = _vrRef || (lk.master && lk.master.refLink) || ''; } catch (eR) {}
    // v0.9.1180: 'noref' is NOT a fact about the item — see _pinVerifyShow. It
    // means the relay could not get a photo from that page, which is very often
    // the site refusing an automated request. Caching it meant the button never
    // tried again, so a site that came back, or a relay that learned to reach
    // it, would never be noticed. Only a real answer is worth remembering.
    if (vr && vr.ok) _vfCache[key] = vr;
    // the card may have re-rendered while we were away — find the live node
    var live = document.getElementById('pin-rv-verify') || el;
    _pinVerifyShow(live, vr);
  }
  // Swap which button looks like the thing to press. Nothing is disabled — Brad
  // may know perfectly well that the catalog photo is of a different variation —
  // but the default should not be the action the app has just argued against.
  function _pinDemoteAdd(demote) {
    try {
      var add = document.getElementById('pin-rv-add');
      var tok = document.getElementById('pin-rv-idtoken');
      if (add) {
        add.className = demote ? '' : 'btn-primary';
        if (demote) _pinOpaqueTint(add, '139,142,148', 12);   // v0.9.1282
        else add.style.background = '';
        add.style.color = demote ? 'var(--text-mid)' : '';
        add.style.border = demote ? '1.5px solid #8b8e94' : 'none';
        add.title = demote ? 'The catalog photo does not match — check the number first' : '';
      }
      if (tok) {
        if (demote) tok.style.background = 'var(--accent)';
        else _pinOpaqueTint(tok, '212,168,67', 14);   // v0.9.1282
        tok.style.color = demote ? '#fff' : 'var(--accent2,#d4a843)';
        tok.style.borderColor = demote ? 'var(--accent)' : 'var(--accent2)';
      }
    } catch (e) {}
  }

  function _pinVerifyShow(el, vr) {
    var esc = function (s) { return String(s || '').replace(/</g, '&lt;'); };
    if (!vr || !vr.ok) {
      var r = vr && vr.reason;
      // v0.9.1180 (Brad's Lionel 2233810, whose page plainly HAS a photo).
      // "No usable catalog photo on the reference page" is a claim about the
      // page, and the app is not in a position to make it. What actually
      // happened is that the relay could not get a photo from that page — and
      // for lionel.com the reason is that the site returns 403 to automated
      // requests, exactly as it does to every other datacenter fetcher. Saying
      // the page has no photo when it visibly does is how a working feature
      // gets reported as broken.
      //
      // So: say what WE could not do, and hand over the page so the compare can
      // still be made by eye. barcode.js has done this since v0.9.1016; the
      // inbox was the one that dead-ended.
      var _vRef = (vr && vr._ref) || '';
      var _vOpen = _vRef
        ? ' <a href="' + rrEsc(_vRef) + '" target="_blank" rel="noopener" style="color:var(--info)">open the page ↗</a>'
        : '';
      if (r === 'noref') el.innerHTML = '<div style="font-size:0.76rem;color:var(--text-dim)">Couldn\'t get the catalog photo from that page — some sites block automated requests.' + _vOpen + '</div>';
      else if (r === 'quota') el.innerHTML = '<div style="font-size:0.76rem;color:var(--text-dim)">No photo IDs left today — the catalog double-check can run tomorrow.</div>';
      else if (r === 'noconsent') el.innerHTML = '';
      else el.innerHTML = '<div style="font-size:0.76rem;color:var(--text-dim)">Couldn\'t run the catalog-photo check right now.' + _vOpen + '</div>';
      return;
    }
    if (vr.match === 'yes') {
      _pinDemoteAdd(false);
      el.innerHTML = '<div style="font-size:0.84rem;color:var(--t-green);font-weight:700">✓ Your photo matches the catalog listing' +
        (vr.refItem ? ' <span style="font-weight:400;color:var(--text-dim)">(' + esc(vr.refItem) + ')</span>' : '') + '</div>';
    } else if (vr.match === 'no') {
      el.innerHTML =
        '<div style="font-size:0.84rem;color:var(--t-red);font-weight:700;line-height:1.45">✗ Your photo does NOT match the catalog listing' +
        (vr.differences && vr.differences.toLowerCase() !== 'none' ? ' — ' + esc(vr.differences) : '') + '</div>' +
        (vr.refItem ? '<div style="font-size:0.76rem;color:var(--text-dim);margin-top:0.15rem">Catalog photo shows: ' + esc(vr.refItem) + '</div>' : '') +
        (!_pinAr() ? '' : '<button onclick="_pinVerifyReident()" style="margin-top:0.4rem;padding:0.45rem 0.7rem;border-radius:8px;border:none;background:#f05008;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">Re-identify with this clue</button>');
      // The app has just said, in red, that this is the wrong item. Leaving Add
      // as the orange default invites the tap that files it anyway.
      _pinDemoteAdd(true);
    } else {
      el.innerHTML = '<div style="font-size:0.78rem;color:var(--t-gold)">? Couldn\'t confirm against the catalog photo' +
        (vr.differences && vr.differences.toLowerCase() !== 'none' ? ' — ' + esc(vr.differences) : '') + '</div>';
    }
  }
  window._pinVerifyReident = async function () {
    if (!_pinAr()) return;   // v0.9.1927: paid read — beta feature
    // v0.9.1418: this one already spoke, but only ever said "already
    // running" — which is a lie once the job is wedged. Through the shared
    // bounce it can offer the way out instead.
    if (PIN._busy) { _pinBusyBounce(); return; }
    var g = PIN._rvGroups && PIN._rvGroups[0];
    if (!g) return;
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    var vr = _vfCache[g.files[0].id + '|' + num];
    PIN._vfNote[g.key] = 'The number ' + num + ' was proposed, but the catalog reference photo for that number shows a DIFFERENT product' +
      (vr && vr.differences ? ' (' + vr.differences + ')' : '') + '.';
    var ids = _ids();
    delete ids[_pinReadFid(g)];
    _idsSave(ids);
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    await _pinIdentifyRun([g], ids);
    delete PIN._vfNote[g.key];
    window._pinReview(g.key);
  };

  // v0.9.969 (Brad): show the daily token count on the review card. The relay
  // returns "remaining" after each paid read; we cache the last one (per day)
  // and display it so the count stays visible without an extra request.
  function _tokGet() {
    // v0.9.1496 (Brad: "the 13 photo ids left is the same i had yesterday"):
    // the v1472 quota store — refreshed by the relay's ai_quota on every app
    // boot — outranks this line's own response-fed cache, which could only
    // ever repeat the last READ's number.
    try {
      var p = String(localStorage.getItem('rr_ai_remaining') || '').split('|');
      if (p.length === 2 && p[1] === new Date().toDateString()) {
        var q = parseInt(p[0], 10);
        if (!isNaN(q) && q >= 0) return q;
      }
    } catch (e0) {}
    try { var o = JSON.parse(localStorage.getItem('rr_tokens_left') || 'null');
      return (o && o.d === new Date().toISOString().slice(0, 10) && typeof o.n === 'number') ? o.n : null; }
    catch (e) { return null; }
  }
  function _tokSave(n) {
    try { if (typeof n === 'number') localStorage.setItem('rr_tokens_left', JSON.stringify({ d: new Date().toISOString().slice(0, 10), n: n })); } catch (e) {}
  }
  function _tokLine() {
    var n = _tokGet();
    // v0.9.1163: when reads are switched off, the count is beside the point —
    // say what is actually true and where to change it. "Token count shows after
    // your next read" was technically correct and completely unhelpful: there
    // was never going to BE a next read.
    if (typeof rrAiOptedOut === 'function' && rrAiOptedOut()) {
      // var(--warn) with NO hex fallback: :root defines it (v0.9.1148), and the
      // colour ratchet correctly refuses one more literal in this file.
      return '<div id="pin-rv-tokline" style="text-align:center;font-size:0.8rem;'
        + 'color:var(--warn);margin-top:0.6rem">'
        + 'Photo ID reads are off — Preferences › Photo ID</div>';
    }
    return '<div id="pin-rv-tokline" style="text-align:center;font-size:0.8rem;color:var(--text-dim);margin-top:0.6rem">' +
      (n !== null
        ? '<span style="color:var(--accent2,#d4a843);font-weight:700;font-size:0.95rem">' + n + '</span> photo ID' + (n === 1 ? '' : 's') + ' left today'
        : 'Photo ID count shows after your next read') +
      '</div>';
  }
  // (The review card — arrows, order, view slots, the card itself — → app/photo-inbox-review.js, split step 4.)

  // "From the photo" line — everything the AI read, so a wrong read (e.g. a
  // background box's number) is obvious at a glance. (Brad, 2026-07-16)
  // The stored reasoning for a photo that came back empty.
  function _pinFailInfo() {
    try {
      var fid = PIN._rvGroups && PIN._rvGroups.length ? _pinReadFid(PIN._rvGroups[0]) : '';
      var f = _freeTried()[fid];
      return (f && typeof f === 'object') ? f : null;
    } catch (e) { return null; }
  }

  // Shared "why" block, used by both a read and a failed read.
  // ══ v0.9.1173 — ONE PLAIN-ENGLISH ACCOUNT OF A READ ════════════════════
  // Brad: "is haveing a research box showing what is happening so that a user can
  // see it working and might find it interesting to know whats going on." He chose
  // plain lines with the detail on tap.
  //
  // The live box and the after-the-fact disclosure are the same story told at two
  // moments, so they come from ONE function. Two renderings of one event drift —
  // that class of bug bit seven separate times on 2026-07-30 — and a progress line
  // that disagrees with the explanation underneath it is worse than no progress
  // line at all.
  //
  // Plain words on purpose: this is the part a collector reads. The technical
  // trace stays behind the expander, untouched.
  // ══ v0.9.1174 — HOW LONG IS THIS GOING TO TAKE? ════════════════════════
  // Brad: "add a time estimate to the right of the reading photos statement. it
  // supposed to be, so many minutes left... approximately x:xx am/pm and round up
  // to the nearest 5 minutes."
  //
  // Measured, not guessed: the average of the work actually done so far on THIS
  // run. Photos vary — a re-read at full size costs more than a cached one — so a
  // fixed per-photo figure would be wrong within a minute and stay wrong.
  //
  // Rounded UP to five minutes, his instruction, and it is the honest direction:
  // an estimate that runs over feels like a broken promise, one that comes in
  // early feels like a gift. The clock time is DERIVED from the rounded minutes so
  // the two halves cannot contradict each other — "10 minutes left, done at 11:47"
  // would just look wrong.
  //
  // Nothing is shown for the first few seconds or the first item: one sample is
  // not a rate, and a wild first guess that then halves is worse than silence.
  function _pinEtaText(done, total, startMs) {
    try {
      if (!startMs || !done || !total || done >= total) return '';
      var elapsed = Date.now() - startMs;
      if (done < 2 || elapsed < 5000) return '';
      var leftMs = (elapsed / done) * (total - done);
      var mins = Math.ceil(leftMs / 60000 / 5) * 5;
      if (mins < 5) mins = 5;
      var eta = new Date(Date.now() + mins * 60000);
      var h = eta.getHours(), ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12; if (!h) h = 12;
      var mm = String(eta.getMinutes());
      if (mm.length < 2) mm = '0' + mm;
      return 'about ' + mins + ' minutes left \u00b7 done around ' + h + ':' + mm + ' ' + ampm;
    } catch (e) { return ''; }
  }

  // ── The live half: the same story, told while it happens ────────────────
  // Progress steps come from ONE table too, for the same reason. The box is
  // written into the read line's slot, so it occupies the space the answer will
  // fill — the user watches the thing they are waiting for, not a spinner parked
  // somewhere else on the card.
  var RR_READ_STEPS = {
    start:   'Looking for a printed number\u2026',
    bigger:  'Nothing yet \u2014 looking again at full size\u2026',
    catalog: 'Checking the catalog\u2026',
    paid:    'Asking the photo reader\u2026',
  };
  var _pinSteps = [];
  function _pinResearchHtml(done) {
    if (!_pinSteps.length) return '';
    return '<div id="pin-rv-research" style="background:var(--surface2);border:1px solid var(--border);'
      + 'border-radius:9px;padding:0.5rem 0.65rem;margin-bottom:0.6rem;font-size:0.78rem;'
      + 'color:var(--text-mid);line-height:1.6">'
      + (done ? '' : '<span style="display:inline-block;animation:spin 0.8s linear infinite;'
          + 'color:var(--info);margin-right:0.35rem">\u21bb</span>')
      + _pinSteps.map(function (l) { return '<div>\u00b7 ' + rrEsc(l) + '</div>'; }).join('')
      + '</div>';
  }
  function _pinStep(msg, done) {
    if (!msg) return;
    if (_pinSteps[_pinSteps.length - 1] !== msg) _pinSteps.push(String(msg));
    try {
      var host = document.getElementById('pin-rv-ailine');
      if (host) host.innerHTML = _pinResearchHtml(done);
    } catch (e) {}
  }
  function _pinStepsReset() { _pinSteps = []; }

  function _pinPlainWhy(dbg, raw) {
    var out = [];
    if (!dbg) return out;
    var eraName = dbg.era ? _pinEraLabel(dbg.era)
      : ((dbg.eras && dbg.eras.length)
          ? dbg.eras.map(function (e) { return _pinEraLabel(e); }).join(' or ')
          : '');
    out.push(raw ? 'Looked for a printed number' : 'Looked for a printed number — nothing came back');
    if (eraName) out.push('Searching ' + eraName);
    var cand = (dbg.cand || []).concat(dbg.shortCand || []);
    if (cand.length) out.push('Numbers seen: ' + cand.slice(0, 4).join(', '));
    if ((dbg.lettered || []).length) out.push('Kept the letter stamped before the number: ' + dbg.lettered.join(', '));   // v0.9.1886
    if (dbg.viaLetter) out.push(dbg.viaLetter + ' is how the catalogue spells this car \u2014 kept over a plain number read elsewhere in the photo');   // v0.9.1887
    if (dbg.joined) out.push('Pieced ' + dbg.joined + ' together from split digits');
    // v0.9.1732 — say it on the CARD, not only behind the disclosure triangle.
    // "Pieced X together" above reads like a success; this is the line that
    // says it was never certain.
    if (dbg.assembledNotRead) out.push('Pieced together, not read — offered for you to confirm, not asserted');
    if (dbg.directOverJoin) out.push('Kept the number actually read: ' + dbg.directOverJoin);
    if (dbg.viaMaker) out.push(dbg.viaMaker + ' was stamped next to the maker\u2019s name');
    if ((dbg.inEra || []).length) out.push('In that catalog: ' + dbg.inEra.slice(0, 3).join(', '));
    if ((dbg.offEra || []).length) out.push('In another maker\u2019s catalog: ' + dbg.offEra.slice(0, 3).join(', '));
    if (dbg.quoted) out.push('The catalog itself quotes that number: ' + dbg.quoted);
    if (dbg.quoteGated) out.push('Long shot set aside: ' + dbg.quoteGated);   // v0.9.1486: guesses demoted, never hidden
    if (dbg.repaired) out.push('One digit looked misread — corrected to ' + dbg.repaired);
    if (dbg.family) out.push('Family: ' + dbg.family);
    if (dbg.noLetters) out.push('No lettering was legible, so ' + dbg.noLetters + ' was not trusted');
    if (dbg.shortSolo) out.push('Only three digits, seen once — offered, not asserted');
    if ((dbg.shortDropped || []).length) out.push('Too short to trust alone: ' + dbg.shortDropped.join(', '));
    // v0.9.1277: rejections were doing their work invisibly — the right answer
    // can be sitting on this list, and until now nothing on screen said so.
    if ((dbg.rejectedList || []).length) out.push('Left out because you marked them wrong earlier: ' + dbg.rejectedList.slice(0, 4).join(', '));
    if (dbg.rejectedStrong) out.push('But the car itself reads ' + dbg.rejectedStrong + ' — if that mark was a mistake, un-check it in the excluded numbers list on the card, then hit re-scan');
    return out;
  }
  function _pinPlainWhyHtml(dbg, raw) {
    var lines = _pinPlainWhy(dbg, raw);
    if (!lines.length) return '';
    return '<div style="font-size:0.76rem;color:var(--text-mid);line-height:1.6;margin-bottom:0.3rem">'
      + lines.map(function (l) {
          return '<div>\u00b7 ' + rrEsc(l) + '</div>';
        }).join('')
      + '</div>';
  }

  function _pinWhyHtml(raw, dbg, ai) {
    if (!raw && !dbg && !(ai && (ai.aiRaw || ai.aiSku))) return '';
    // v0.9.1173: the same plain account the research box showed live, kept above
    // the technical trace so the two can never tell different stories.
    return _pinPlainWhyHtml(dbg, raw)
      + '<details style="margin-top:0.3rem"><summary style="font-size:0.7rem;color:var(--text-dim);cursor:pointer">Where did this come from?</summary>'
      + '<div style="font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:0.25rem;line-height:1.4;word-break:break-word">'
      + (ai && ai.aiRaw
          ? '<div style="margin-bottom:0.35rem">The paid reader answered: \u201c' + rrEsc(ai.aiRaw) + '\u201d'
            + (ai.aiSku ? '<br>It gave the number ' + rrEsc(ai.aiSku)
                + ', which is not in this photo\u2019s catalog \u2014 a closer one from its own answer was used instead.' : '')
            + '</div>'
          : '')
      + (raw ? 'The reader saw: \u201c' + rrEsc(raw) + '\u201d'
             : (ai && ai.aiRaw ? '' : 'The reader returned no text at all.'))
      + (dbg
          ? '<div style="margin-top:0.35rem">'
            // v0.9.1167: name every era the filter covered. Saying "no era filter
            // applied" while the user sat on Lionel / O / Modern was true of the
            // code and false of their screen — and it was the clue that found the
            // Atlas bug, so it has to stay accurate.
            + 'Photo is stamped: <b>' + rrEsc(
                dbg.era ? _pinEraLabel(dbg.era)
                : ((dbg.eras && dbg.eras.length)
                    ? dbg.eras.map(function (e) { return _pinEraLabel(e); }).join(' or ')
                    : 'nothing \u2014 no era filter applied')) + '</b><br>'
            + 'Numbers considered: ' + rrEsc((dbg.cand || []).join(', ') || 'none')
              + ((dbg.shortCand && dbg.shortCand.length)
                  ? ' (plus short: ' + rrEsc(dbg.shortCand.join(', ')) + ')' : '') + '<br>'
            + 'In that catalog: ' + rrEsc((dbg.inEra || []).join(', ') || 'none') + '<br>'
            + 'In another catalog: ' + rrEsc((dbg.offEra || []).join(', ') || 'none')
            + (dbg.joined ? '<br>Recovered by joining split digits: ' + rrEsc(dbg.joined) : '')
            + (dbg.directOverJoin ? '<br>Kept the number actually read: ' + rrEsc(dbg.directOverJoin) : '')
            + ((dbg.joinTried && dbg.joinTried.length)
                ? '<br>Reassembled and tried: ' + rrEsc(dbg.joinTried.slice(0, 10).join(', ')) : '')
            + (dbg.viaDesc ? '<br>Matched on the words: ' + rrEsc(dbg.viaDesc) : '')
            + (dbg.corroborated ? '<br>Number and lettering agree: ' + rrEsc(dbg.corroborated) : '')
            + (dbg.oneOff ? '<br>One digit corrected: ' + rrEsc(dbg.oneOff) : '')
            + (dbg.windowAmbig ? '<br>Could be any of: ' + rrEsc(dbg.windowAmbig)
                + ' \u2014 several real numbers fit these digits, so nothing was assumed' : '')
            + (dbg.edgeOnly ? '<br>Found only at the edge of the frame \u2014 possibly the shelf or wall, not the item' : '')
            + (dbg.quoted ? '<br>The tag settled it: ' + rrEsc(dbg.quoted)
                + ' \u2014 this catalog\u2019s row quotes the number on the car' : '')
            + ((dbg.shortDropped && dbg.shortDropped.length)
                ? '<br>Too short to trust on their own: ' + rrEsc(dbg.shortDropped.join(', ')) : '')
            + (dbg.viaMaker ? '<br>Chosen because it is stamped next to the maker\'s name: ' + rrEsc(dbg.viaMaker) : '')
            // v0.9.1166: the lettering and the number point at different items.
            // Both are shown; neither is asserted.
            + (dbg.nameVsNumber ? '<br>The lettering and the number disagree: ' + rrEsc(dbg.nameVsNumber)
                + ' \u2014 the lettering leads because it is physically on the item, but check both' : '')
            + (dbg.typeClash ? '<br>They are not even the same kind of item: ' + rrEsc(dbg.typeClash) : '')
            + (dbg.shortVsLong ? '<br>Two catalog numbers disagree: ' + rrEsc(dbg.shortVsLong)
                + ' — both offered, pick the one on your item' : '')
            + (dbg.shortBacked ? '<br>A short number the catalog recognises (' + rrEsc(dbg.shortBacked)
                + ') outranked longer text found in no catalog' : '')
            + (dbg.pooled ? '<br>Decided from everything all the passes read together' : '')
            + (dbg.family ? '<br>Family: ' + rrEsc(dbg.family) : '')
            + (dbg.familyOverLead ? '<br>The family is in this catalog, so it outranks ' + rrEsc(dbg.familyOverLead)
                + ', a number from another catalog' : '')
            + (dbg.freqPick ? '<br>Two real numbers were in view \u2014 kept the one read most often: '
                + rrEsc(dbg.freqPick) : '')
            + (dbg.offEraLead ? '<br>The number read on the car (' + rrEsc(dbg.offEraLead)
                + ') belongs to another era\u2019s catalog \u2014 it leads the choices for you to settle' : '')
            + (dbg.longerUnexplained ? '<br>A longer digit-run (' + rrEsc(dbg.longerUnexplained)
                + ') matched nothing, so this short number is offered, not asserted' : '')
            + (dbg.shortSolo ? '<br>Only three digits, seen once \u2014 offered, not asserted' : '')
            + (dbg.colorClash ? '<br>Colors disagree: ' + rrEsc(dbg.colorClash) + ' \u2014 treated as a guess' : '')
            + (dbg.escalated ? '<br>Read again at full size after the fast read came up short' : '')
            + (dbg.noEraJoin ? '<br>Assembled from split digits with no maker/era tag on this photo '
                + '— that can match the wrong maker\u2019s list, so it is only offered. '
                + 'Tag the photo and re-read for a filtered answer.' : '')
            // v0.9.1732: the same honesty when the photo IS tagged. A short
            // number carved out of scattered digits lands on a real catalog
            // row too easily to be stated as fact, and the era does not change
            // that — it only decides which catalog the coincidence happens in.
            + (dbg.assembledNotRead ? '<br>' + rrEsc(dbg.assembledNotRead)
                + ' — short numbers pieced together land on a real catalog row '
                + 'too easily to be called certain, so it is offered for you to '
                + 'confirm rather than asserted' : '')
            + (dbg.stampSaw ? '<br>The light-numbers pass saw: “' + rrEsc(dbg.stampSaw) + '”' : '')
            // v0.9.1294 (Brad, request #30): the excluded-numbers line MOVED
            // from this collapsed panel onto the result card, one checkbox per
            // number (_pinExcludedHtml). The one fact that explains a wrong
            // answer no longer hides behind a disclosure triangle.
            + (dbg.rejectedStrong
                ? '<br>The maker\'s name is stamped beside ' + rrEsc(dbg.rejectedStrong)
                  + ' — the strongest read in this photo, silenced by that mark; un-check it in the excluded numbers list on the card, then re-scan' : '')
            + (dbg.evidence !== undefined
                ? '<br>Readable characters recovered: ' + dbg.evidence
                  + (dbg.evidence < 18 ? ' \u2014 too few to be sure of anything' : '')
                : '')
            + '</div>'
          : '')
      + '</div></details>';
  }

  // ══ v0.9.1168 — A SPINNING ARROW ON EVERY SCAN ═════════════════════════
  // Brad: "anytime we are scanning, we need the arrow going arond in a circle, so
  // a user knows its doing something. this goes for the read this photo too."
  // He hit this twice in one evening — a button that only changes its text is
  // indistinguishable from a button that did nothing, and he spent a look at the
  // screen each time working out which it was.
  //
  // ONE helper, so a scan button cannot be wired up without it, and it reuses the
  // same glyph and `spin` keyframes as the inbox status bar. A second animation
  // would be a second thing to keep in step. Returns a restore function, which
  // also means the caller never has to know what the label said before — the
  // v0.9.1163 "reads are off" wording restores itself for free.
  function _pinBtnBusy(btn, label) {
    if (!btn) return function () {};
    var was = btn.innerHTML, wasOff = btn.disabled;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite;'
      + 'font-size:0.95rem;line-height:1;margin-right:0.35rem">\u21bb</span>'
      + String(label == null ? 'Working\u2026' : label).replace(/</g, '&lt;');
    return function () { try { btn.innerHTML = was; btn.disabled = wasOff; } catch (e) {} };
  }

  // ══ v0.9.1775 — A BUSY BUTTON YOU CAN PRESS ══════════════════════════════
  // Brad: "there is not stop scan button. so the scan button when hit needs to
  // have the rotating arrow, but also have 'stop scan' so you can stop it if
  // you want to." _pinBtnBusy DISABLES the button, which is precisely why there
  // was nothing to press — he reloaded the whole app instead, and that reload is
  // what started the afternoon's confusion.
  //
  // Same spinner, same restore contract, but the button stays live and its click
  // becomes the stop. The original onclick is put back with everything else.
  function _pinBtnStop(btn, label, onStop) {
    if (!btn) return function () {};
    var was = btn.innerHTML, wasOff = btn.disabled, wasClick = btn.onclick;
    btn.disabled = false;
    btn.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite;'
      + 'font-size:0.95rem;line-height:1;margin-right:0.35rem">\u21bb</span>'
      + String(label == null ? 'Stop scan' : label).replace(/</g, '&lt;');
    var fired = false;
    btn.onclick = function (ev) {
      try { if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (e) {}
      if (fired) return;
      fired = true;
      try { if (onStop) onStop(); } catch (e) {}
    };
    return function () {
      try { btn.innerHTML = was; btn.disabled = wasOff; btn.onclick = wasClick; } catch (e) {}
    };
  }
  // (→ app/photo-inbox-tools.js, split step 5: moved word for word.)

  // ══ v0.9.1738 — A DRIVE FAILURE NOW SAYS WHAT IT WAS ══════════════════════
  // Brad, twice on one afternoon: "Your sign-in expired — refresh the page,
  // then crop again." His auth log for the same minutes: token restored,
  // renewed, healthy, no errors. All 66 inbox photos fetched HTTP 200 with
  // that token when checked. The message was wrong, and nothing could say why,
  // because this function threw Google's answer away:
  //
  //     if (r.status === 401 || r.status === 403) throw SESSION_EXPIRED
  //
  // A 401 is an expired sign-in. A 403 from Drive is usually NOT — it is
  // "userRateLimitExceeded" after a burst (a 66-photo read, 66 stamps blanked
  // and rewritten, a grid of thumbnails), and "refresh the page" only appears
  // to cure that because the burst has passed by the time the page is back.
  // v0.9.1443 named the 401 correctly and swept the 403 in with it.
  //
  // So, three things, in this order:
  //   1. READ THE REASON Google sends, and write every failure to the app's
  //      own sync log (the one his token history was just read from). The next
  //      time this happens, one look at the log names the cause.
  //   2. RETRY A RATE LIMIT on its own — 1s, 2s, 4s — before saying anything.
  //      Most of the time that is the whole fix and no message is shown.
  //   3. SAY "SIGNED OUT" ONLY WHEN IT IS TRUE: a 401, or a 403 with an auth
  //      reason while the app's own token record agrees it has lapsed. Any
  //      other 403 is reported as what it is, with the reason in the text.
  //
  // The thrown messages are shaped so rrSaveError (write-outbox.js) maps them
  // without changes: "rate limit" → "Google is asking us to slow down",
  // "drive 403 …" → the sharing/permission line. All ten callers benefit.
  var _PIN_BYTES_TRIES = 3;
  function _pinDriveReason(r) {
    // Google's error body: { error: { code, message, errors: [{ reason, … }] } }
    return r.json().then(function (j) {
      var e = (j && j.error) || {};
      var first = (e.errors && e.errors[0]) || {};
      return { reason: String(first.reason || e.status || ''), msg: String(e.message || '').slice(0, 120) };
    }).catch(function () { return { reason: '', msg: '' }; });
  }
  function _pinTokenLapsed() {
    try {
      if (typeof _rrTokenExpiry === 'function') return _rrTokenExpiry() <= Date.now();
      var ex = parseInt(localStorage.getItem('lv_token_expiry') || '0', 10);
      return !ex || ex <= Date.now();
    } catch (e) { return false; }
  }
  async function _pinBytes(fileId, _try) {
    _try = _try || 1;
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: { Authorization: 'Bearer ' + window.accessToken } });
    if (r.ok) return await r.blob();
    var why = await _pinDriveReason(r);
    var tag = String(fileId || '').slice(-8) + ' -> ' + r.status + (why.reason ? ' ' + why.reason : '') + (_try > 1 ? ' (try ' + _try + ')' : '');
    try { if (typeof window.rrSyncLog === 'function') window.rrSyncLog('drive', 'GET ' + tag); } catch (eL) {}
    var rateLimited = r.status === 429
      || (r.status === 403 && /ratelimit|quota|backend/i.test(why.reason + ' ' + why.msg));
    if (rateLimited && _try < _PIN_BYTES_TRIES) {
      await new Promise(function (res) { setTimeout(res, 1000 * Math.pow(2, _try - 1)); });
      return _pinBytes(fileId, _try + 1);
    }
    if (rateLimited) throw new Error('rate limit: Drive refused the photo ' + _PIN_BYTES_TRIES + ' times (' + (why.reason || r.status) + ')');
    if (r.status === 401) throw new Error('SESSION_EXPIRED');
    if (r.status === 403) {
      var authShaped = /auth|token|expired|login|insufficientPermissions|forbidden/i.test(why.reason + ' ' + why.msg);
      if (authShaped && _pinTokenLapsed()) throw new Error('SESSION_EXPIRED');
      throw new Error('drive 403 ' + (why.reason || 'forbidden') + (why.msg ? ': ' + why.msg : ''));
    }
    throw new Error('photo download ' + r.status + (why.reason ? ' ' + why.reason : ''));
  }

  // ── FREE auto-read: read the catalog number off each photo with on-device
  //    OCR (Tesseract.js from CDN) — no AI credits, runs in the background as
  //    photos land. Reads that the master confirms show as a solid number;
  //    unconfirmed reads show as a hedge; photos it can't read stay open for
  //    the paid AI. OCR is optional: if it won't load, paid identify still works.
  var _autoReadBusy = false, _autoReadAbort = false;   // (the reader's own worker state moved with it — split step 3)
  var FREE_TRIED_KEY = 'rr_inbox_freetried';
  function _freeTried() { try { return JSON.parse(localStorage.getItem(FREE_TRIED_KEY) || '{}'); } catch (e) { return {}; } }
  function _freeTriedSave(m) { try { localStorage.setItem(FREE_TRIED_KEY, JSON.stringify(m)); } catch (e) {} }

  // (The on-device number reader — Tesseract, _numberFromText, barcodes, the catalogue word and quote matches,
  //  the arbitration — → app/photo-inbox-reader.js, split step 3.)

  // v0.9.1092 — the photo actually ON SCREEN in the review card, which since
  // per-member reads is the one every read button should mean. Falls back to
  // the group's readable photo when the card is not open or nothing was tapped.
  function _pinOnScreenFid() {
    try {
      var img = document.getElementById('pin-rv-main');
      var fid = img && img.getAttribute('data-rvbig');
      if (fid) return fid;
    } catch (e) {}
    try { return _pinReadFid(PIN._rvGroups[0]); } catch (e2) { return ''; }
  }

  // The era stamped on a photo, in the shape findMaster's `prefer` wants.
  function _pinPreferOf(fileOrGroup) {
    try {
      var f = (fileOrGroup && fileOrGroup.files) ? _pinReadFile(fileOrGroup) : fileOrGroup;
      var m = (f && f._meta) || {};
      // v0.9.1152 (Brad: "make sure all only offer what i filter"). This used to
      // `return null` whenever the photo had no per-photo era tag — which is
      // every photo dropped straight into the inbox. Callers then built NO
      // maker/scale/era hint, so the AI and Lens were asked a bare "identify
      // this model railroad item" and answered Atlas / MTH / HO while Brad sat
      // in Lionel Modern. The photo's own tag still wins when present; the
      // app-wide era filter is the fallback.
      // v0.9.1157: ask the one resolver for BOTH routes. Given the photo's own
      // tag it answers for that era; given nothing it answers for whatever the
      // user is filtered to — INCLUDING a hierarchy-chip selection, which the
      // previous version could not see because rrActiveFilter returned null in
      // 'all' mode and the chips run in 'all' mode by design (see the note on
      // rrActiveFilter in config.js). That is why the readers still came back
      // Atlas / MTH / HO after v0.9.1152.
      // v0.9.1488 (Brad: "the my collection page filters should have nothing
      // whatsoever to do with the photo inbox and when i google lens or read
      // it button"): the photo's OWN tag is the only filter a read may use.
      // Untagged photo = neutral question. The v1157 fallback-to-global is
      // RETIRED — it kept turning stale browsing filters into wrong hints
      // ("how did i filter to mth?" — he hadn't).
      // v0.9.1504 (task #29): a maker-less tag ('?|O|postwar') answers with
      // exactly what it knows — scale and/or period. No maker invented,
      // and rrActiveFilter never sees the synthetic key.
      var _tp = (m.era && typeof rrTagParse === 'function') ? rrTagParse(m.era) : null;
      if (_tp && _tp.partial) {
        // v0.9.1505: an era-carrying partial ("Marx O · Postwar") keeps its
        // catalog scoping and maker; the period rides for the soft rank.
        var _mfr5 = '', _eras5 = [];
        if (_tp.era) {
          _eras5 = [_tp.era];
          try { _mfr5 = (typeof ERAS !== 'undefined' && ERAS[_tp.era]) ? (ERAS[_tp.era].manufacturer || '') : ''; } catch (e5) {}
        }
        return {
          era: _tp.era || '', eras: _eras5, manufacturer: _mfr5,
          label: _pinEraLabel(m.era),
          years: (_tp.period && typeof _RR_PERIOD_YEARS !== 'undefined' && _RR_PERIOD_YEARS[_tp.period]) || '',
          scale: _tp.scale || '', period: _tp.period || '',
          // v0.9.1733: the KIND rides along too. The Type tag list has no
          // "Box" in it (Paper / Catalog / Other are the paperwork tags) — a
          // photo OF a box is marked by its group kind, and the reader needs
          // that to know a box row is the right answer for once.
          type: m.type || '', kind: m.kind || '', _fromFilter: false,
        };
      }
      var af = (m.era && typeof rrActiveFilter === 'function') ? rrActiveFilter(m.era) : null;
      // v0.9.1297 (Brad: "the photo reader needs to use the type as a helper
      // to decide what it is"): the photo's own Type tag rides on the prefer
      // object — even when no era filter resolves, a typed photo still gets
      // its type hint.
      if (!af) return (m.type || m.kind) ? { era: '', eras: [], manufacturer: '', label: '', years: '', scale: '', type: m.type || '', kind: m.kind || '', _fromFilter: true } : null;
      return {
        era:          af.era || '',        // '' when the filter spans several eras
        eras:         (af.eras && af.eras.length) ? af.eras : (af.era ? [af.era] : []),
        manufacturer: af.manufacturer || '',
        label:        af.label || '',
        years:        af.years || '',
        scale:        af.scale || '',
        type:         m.type || '',
        kind:         m.kind || '',      // v0.9.1733
        _fromFilter:  !m.era,
      };
    } catch (e) { return null; }
  }
  async function _freeReadOne(fileId) {
    // v0.9.1101 (Brad: "the second scan seems to get a lot more accurate,
    // why don't we just run back to back scans?"). His re-scans were reading
    // at 2400px against the auto pass's 1600px — the resolution WAS the
    // accuracy. The fast read still goes first (most photos confirm there
    // and cost nothing extra); anything unconfirmed gets the full-size read
    // automatically, which is what his thumb has been doing all day.
    var bytes = await _pinBytes(fileId);
    var pref = _preferForFid(fileId);
    var r = await _freeReadBlob(bytes, 1600, pref);
    if (!(r && r.matched && r.num)) {
      var r2 = null;
      try { r2 = await _freeReadBlob(bytes, 2400, pref, { barcodeDone: true }); } catch (e2) {}   // v0.9.1977: the barcode was looked for a moment ago
      // The bigger read wins unless it came back with less than the fast one.
      if (r2 && (r2.num || !(r && r.num))) {
        if (r2.dbg) r2.dbg.escalated = true;
        r = r2;
      }
    }
    return r;
  }
  // Find the loaded group that owns this file, so its era stamp can be used.
  function _preferForFid(fileId) {
    for (var i = 0; i < PIN._groups.length; i++) {
      for (var j = 0; j < PIN._groups[i].files.length; j++) {
        if (PIN._groups[i].files[j].id === fileId) return _pinPreferOf(PIN._groups[i]);
      }
    }
    return null;
  }
  // ── Shared free identify engine ──────────────────────────────────────────
  // Barcode (via the wizard's UPC resolver) + printed-number OCR, master-
  // confirmed. Exposed globally so EVERY screen (inbox, wizard Identify,
  // Research by Photo) can try the free read before spending a paid AI credit.
  // Returns { itemNum, matched:true } only on a CONFIDENT (master-backed) hit.
  // v0.9.1977 — ONE READER: the read goes through the same door as Photo ID
  // and the Your Picture box (barcode.js rrReadPictureFile: barcode first, the
  // label next, then this file's closer look), with the screen's filters.
  // Only a single sure answer inside them comes back.
  window.rrIdentifyFree = async function (blob, prefer) {
    try {
      if (typeof window.rrReadPictureFile === 'function') {
        var p = await window.rrReadPictureFile(blob, { prefer: prefer || null });
        if (p && p.kind === 'sure' && p.item && p.item.row)
          return { itemNum: p.item.row.itemNum || p.item.num, matched: true, row: p.item.row, manufacturer: p.item.row.manufacturer || '' };
        return null;
      }
      var r = await _freeReadBlob(blob, 2400, prefer || null);
      if (r && r.num && r.matched) return { itemNum: r.num, matched: true };
    } catch (e) {}
    return null;
  };
  // "This is wrong — re-scan": forget the read and try again at higher detail.
  // v0.9.1277 built the way back from a mistaken "this is wrong" as an
  // all-or-nothing clear (_pinUnreject). v0.9.1294 (request #30) replaced it:
  // the excluded numbers sit on the result card with one checkbox each
  // (_pinExcludedHtml / _pinRejectToggle), so a single mistaken mark can be
  // un-checked without forgiving the genuinely-wrong ones — then THIS button
  // re-scans. The re-scan itself still records the CURRENT answer as
  // rejected — that rule (v0.9.1168) is Brad's and it stays — so un-marking
  // never re-offers the answer the user is looking at right now.
  window._pinRescan = async function () {
    if (!PIN._rvGroups || !PIN._rvGroups.length) return;
    // v0.9.1074: this read files[0] directly. Since v0.9.1061 every OTHER read
    // path picks the group's readable photo instead — skipping the "everything
    // together" shot, which has several numbers in it. On a grouped item that
    // meant re-scan read a photo nothing else reads, and stored the answer under
    // a file id nothing else looks at: the button appeared to do nothing at all.
    // v0.9.1092 (Brad: "when you hit rescan on an item picture, it goes back
    // to the main picture"). Two faults in one: it re-scanned the group's LEAD
    // photo rather than the one on screen — with per-member reads, tapping the
    // Summit car and hitting re-scan was silently re-reading the engine — and
    // then re-opened the card from scratch, which reset to the first photo.
    var fid = _pinOnScreenFid() || PIN._rvGroups[0].files[0].id;
    var key = PIN._rvGroups[0].key;
    var btn = document.getElementById('pin-rv-rescan');
    // v0.9.1775 — stoppable. On stop the card goes back EXACTLY as it was,
    // which is Brad's call and a better reason than the one I offered: "it
    // should go back in as that maybe the reason you wanted to stop."
    //
    // Restoring _prevRead also takes the rejection back off, because the new
    // rejection is only ever written once the read FINISHES (see _rejected
    // below) — so an abandoned scan never recorded one. Showing a number the
    // app had simultaneously been told was wrong would contradict itself, and
    // would suppress that number on every future scan.
    var _aborted = false;
    var _reBusy = _pinBtnStop(btn, 'Stop scan', function () {
      if (_aborted) return;
      _aborted = true;
      try { if (_prevRead) { var _mm2 = _ids(); _mm2[fid] = _prevRead; _idsSave(_mm2); } } catch (eR) {}
      try { _reBusy(); } catch (eB) {}
      // IN PLACE — never window._pinReview(key) from here. Re-opening the card
      // RESETS A GROUP TO PHOTO 1, so a stop while looking at the third photo of
      // a set would silently move him. The photo-inbox suite guards that rule and
      // it caught the first version of this handler, which did re-open the card.
      // Same three elements the card updates itself, and nothing else.
      try {
        var _nb = document.getElementById('pin-rv-num');
        if (_nb) _nb.value = (_prevRead && _prevRead.num) ? String(_prevRead.num) : '';
      } catch (eN) {}
      try { _pinStepsReset(); } catch (eS) {}
      try {
        var _ln = document.getElementById('pin-rv-ailine');
        if (_ln) _ln.innerHTML = (_pinAiLine(fid) || '') + _pinTagLineHtml(fid);
      } catch (eL) {}
      try { _render(); } catch (eRn) {}
      showToast('Scan stopped \u2014 put back the way it was', 2600);
    });
    // v0.9.1168 (Brad: "if i hit this is wrong, rescan, delete everything that the
    // old scan says on my screen and start over"). The stored entry was already
    // being cleared below, but the CARD kept showing the old number, maker and
    // description for the whole read — so the screen still asserted an answer the
    // user had just told the app was wrong.
    //
    // Cleared in place rather than by re-opening the card: window._pinReview()
    // resets to the group's first photo, which is the v0.9.1092 bug. And the
    // stored record is snapshotted, not destroyed — v0.9.1150 is about paid detail
    // surviving a re-scan, and this must not undo it. Screen only.
    try {
      var _n0 = document.getElementById('pin-rv-num');
      if (_n0) _n0.value = '';
      var _i0 = document.getElementById('pin-rv-info');
      if (_i0) _i0.innerHTML = '';
    } catch (eClr) {}
    // v0.9.1173: the research box takes over the cleared read line and narrates.
    _pinStepsReset();
    _pinStep(RR_READ_STEPS.start);
    // v0.9.1150 (beta punch list 1.5): re-scan threw the whole entry away and
    // wrote a bare free-reader result in its place. On a photo the user had
    // PAID to identify, that silently destroyed mfr / desc / road / year /
    // gauge / subType — even when the re-scan came back with the very same
    // number. Snapshot it first: the paid identification is worth far more
    // than the number sitting next to it, and it is not refundable.
    var _prevRead = null;
    try { var _pm0 = _ids(); if (_pm0[fid]) _prevRead = JSON.parse(JSON.stringify(_pm0[fid])); } catch (eP0) {}
    var _hadPaid = !!(_prevRead && (_prevRead.mfr || _prevRead.desc || _prevRead.road ||
                                    _prevRead.year || _prevRead.gauge || _prevRead.subType));
    var _sameNum = function (a, b) {
      var n = function (v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
      return !!n(a) && n(a) === n(b);
    };
    // v0.9.1151 (pre-beta audit, finding 4 — a hole in yesterday's 1.5 fix):
    // a paid read can legitimately carry a maker and description with NO number
    // (_pinApplyMeta accepts a result that identifies the item but not its
    // catalog number). _sameNum('', '2408') is false by design, so that case
    // took the "different item" branch: the paid detail was cleared AND the user
    // was told it belonged to a different item — which was untrue, there was no
    // other item. A blank previous number contradicts nothing, so keep it.
    var _prevHadNum = !!(_prevRead && String(_prevRead.num || '').trim());
    // v0.9.1168 (Brad: "don't give me the same answer as before if i told you it
    // was wrong"). Pressing this button IS an explicit rejection and nothing was
    // recording it — so a re-scan was free to read the same digits, land on the
    // same row, and hand back the answer he had just refused. The list rides on
    // the entry so it survives across re-scans and accumulates.
    var _rejected = (_prevRead && Array.isArray(_prevRead.rejected)) ? _prevRead.rejected.slice() : [];
    if (_prevHadNum) {
      var _rn = String(_prevRead.num).trim();
      if (_rejected.indexOf(_rn) < 0) _rejected.push(_rn);
    }
    var _keepPaid = function (newNum) {
      return _hadPaid && (!_prevHadNum || _sameNum(_prevRead.num, newNum));
    };
    try {
      try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (e1) {}
      try { var ff = _freeTried(); if (ff[fid]) { delete ff[fid]; _freeTriedSave(ff); } } catch (e2) {}
      try { var pfx = fid + '|'; Object.keys(_vfCache || {}).forEach(function (k) { if (k.indexOf(pfx) === 0) delete _vfCache[k]; }); } catch (e3) {}
      var blob = await _pinBytes(fid);
      // Full multi-pass reader since v0.9.1069 — tiled, then inverted, then
      // digits-only, stopping as soon as the stamped catalog confirms.
      // The rejected list travels on `prefer`, which already reaches the candidate
      // scorer — no new signatures, and one place does the filtering.
      if (_aborted) return;                 // v0.9.1775 — stopped during the fetch
      var _pf = _preferForFid(fid);
      var _pfR = Object.assign({}, _pf || {}, { reject: _rejected });
      _pinStep(RR_READ_STEPS.bigger);
      var r = await _freeReadBlob(blob, 2400, _pfR);
      // v0.9.1775 — THE POINT OF THE STOP. A re-scan is one full-size read, so
      // pressing stop cannot kill the work already running; what it can do is
      // make sure the answer never lands. The screen gave up the moment he
      // pressed it; this is where the late result is thrown away.
      if (_aborted) return;
      _pinStep(RR_READ_STEPS.catalog);
      var m = _ids();
      if (r && r.num) {
        m[fid] = { num: r.num, guess: r.matched ? 0 : 1, alts: r.alts || [], tried: 1, free: 1, raw: r.raw || '', dbg: r.dbg || null, rv: READER_VER, viaDesc: !!r.viaDesc, descOf: r.descOf || '', descWords: r.descWords || [], disagreed: r.disagreed || '', rejected: _rejected };
        // Same item, better read: carry the paid detail across. A DIFFERENT
        // number means the user was right that the old read was wrong, and the
        // paid detail described that wrong item — so it does not come along.
        // A previous read with NO number contradicts nothing, so it is kept
        // (v0.9.1151 — see _keepPaid above).
        if (_keepPaid(r.num)) {
          ['mfr', 'desc', 'road', 'year', 'gauge', 'subType', 'aiRaw', 'aiSku'].forEach(function (k) {
            if (_prevRead[k]) m[fid][k] = _prevRead[k];
          });
        }
        _idsSave(m);
      }
      else {
        var f2 = _freeTried(); f2[fid] = { t: 1, raw: (r && r.raw) || '', dbg: (r && r.dbg) || null, rv: READER_VER }; _freeTriedSave(f2);
        // Keep the rejections even when this read found nothing, or the next
        // re-scan starts from scratch and re-offers what he already refused.
        if (_rejected.length) { m[fid] = Object.assign({}, m[fid] || {}, { rejected: _rejected }); _idsSave(m); }
        // Nothing found. Without this the user would be strictly worse off for
        // having pressed the button: the paid identification deleted, and no
        // number to show for it. Put it back exactly as it was.
        if (_hadPaid) { m[fid] = _prevRead; _idsSave(m); }
      }
      try { _render(); } catch (e4) {}
      _pinStepsReset();
      window._pinReview(key);
      // Come back to the photo the user was actually working on.
      try { window._pinRvSetMain(fid); } catch (eM) {}
      // v0.9.1067 (Brad: "saying still no clear number will piss people off when
      // the number is obviously to a user clear"). He is right, and it is worse
      // than annoying — it is untrue. On his 2408 Santa Fe car the number is
      // perfectly legible to a person; the free reader simply cannot see it, and
      // telling the user to crop tighter implies they took a bad photo when the
      // app is the one that failed. Say what happened, own it, and offer the
      // thing that actually works next.
      if (!(r && r.num)) {
        showToast(_hadPaid
          ? 'The reader could not pick out a number this time — your earlier identification has been kept, nothing was lost'
          : (_pinAr() ? 'The free reader could not pick out a number on this one — type it in, or use “Read this photo” for a closer look' : 'The reader could not pick out a number on this one — type it in, or try Google Photo ID'), 4500);
      } else if (_hadPaid && !_keepPaid(r.num)) {
        // Only say this when it is TRUE: the old read named a different number,
        // so its maker/description really did describe a different item.
        showToast('New number found (' + r.num + ') — the maker and description from the old read were for a different item, so they were cleared', 5000);
      } else if (_hadPaid && !_prevHadNum && r && r.num) {
        showToast('Found number ' + r.num + ' — your paid identification was kept', 4000);
      }
    } catch (e) {
      _reBusy();
      // v0.9.1078: "Re-scan failed — try again" told Brad nothing and told me
      // less. Every other failure in this file explains itself by now; this one
      // swallowed the reason and left him pressing a button that could not work.
      console.error('[inbox] re-scan failed', e);
      var _why = (e && e.message) ? String(e.message).slice(0, 90) : 'unknown error';
      showToast('Re-scan failed \u2014 ' + _why, 5000, true);
    } finally {
      _reBusy();
    }
  };

  window._pinAutoReadCancel = function () { _autoReadAbort = true; };
  // v0.9.1297: ONE builder for "what is still waiting to be read" — the
  // reader loop and the Identify-my-items button count must never disagree.
  // A cropped photo lands here naturally, because cropping clears its read.
  function _pinUnreadScan() {
    var ids = _ids(), ft = _freeTried();
    var _stale = function (rec) {
      // No record at all, or one made by an older reader than the current one.
      if (!rec) return true;
      if (typeof rec !== 'object') return true;         // legacy marker
      return rec.rv !== READER_VER;
    };
    // v0.9.1090: the unit of work is a FILE, not a group — a set contributes
    // every member photo, a single item contributes one.
    //
    // v0.9.1340: ONE walk answers both questions. The button's count and the
    // "left out" note are the same fact seen from two sides, and this project
    // has been bitten six times by one fact computed in two places.
    var todo = [], skipped = [];
    PIN._groups.forEach(function (g) {
      _pinFilesToRead(g).forEach(function (f) {
        var fid = f && f.id;
        if (!fid) return;
        var got = ids[fid];
        if (got && got.rv === READER_VER && !got.guess) return;
        if (got && got.rv === READER_VER) return;
        if (!(_stale(ft[fid]) || !got)) return;
        if (_pinSkipBatchRead(f)) { skipped.push({ g: g, fid: fid }); return; }
        todo.push({ g: g, fid: fid });
      });
    });
    return { todo: todo, skipped: skipped };
  }
  // Back-compatible shape for every existing caller.
  function _pinUnreadTodo() { return _pinUnreadScan().todo; }

  // v0.9.1297 (Brad): the ONE read trigger. Everything below it is unchanged
  // v0.9.1090 machinery — only the STARTER moved from a refresh timer to his
  // finger.
  function _updateIdentifyBtn() {
    var b = document.getElementById('pin-identify-btn');
    if (!b) return;
    var n = 0, nSkip = 0;
    try { var _sc = _pinUnreadScan(); n = _sc.todo.length; nSkip = _sc.skipped.length; } catch (e) {}
    // v0.9.1340: a photo held out of the batch is INVISIBLE otherwise, and an
    // invisible omission reads as a bug. Say the number, say why, say the way
    // round it — in one line, only when there is something to say.
    var sn = document.getElementById('pin-skipnote');
    if (sn) {
      if (nSkip && !PIN._selectMode) {
        sn.textContent = nSkip + ' photo' + (nSkip === 1 ? '' : 's') + ' tagged Paper, Catalog or Other '
          + (nSkip === 1 ? 'is' : 'are') + " not in the batch — there's rarely an item number on a drawing or a page. "
          + 'Tick one and press Identify to read it anyway.';
        sn.style.display = '';
      } else sn.style.display = 'none';
    }
    if (n > 0 && !PIN._selectMode) {
      b.textContent = 'Identify my items — read ' + n + (_pinAr() ? ' (free)' : '');   // v0.9.1956: "free" only beside Auto Read's daily limit
      b.style.display = '';
    } else {
      b.style.display = 'none';
    }
  }
  // ── v0.9.1411 — the phone-only "⋯ More" menu ────────────────────────────
  // Opens/closes the overflow popover that holds the paid "Read the unread"
  // button on phones. A no-op shape on desktop, where the button is inline and
  // this control is never shown. One outside-tap closes it.
  window._pinToggleMore = function (ev) {
    if (ev) { try { ev.stopPropagation(); } catch (e) {} }
    var ov = document.getElementById('pin-overflow');
    var btn = document.getElementById('pin-more-btn');
    if (!ov) return;
    var open = ov.classList.toggle('pin-more-open');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var close = function (e) {
        if (ov.contains(e.target) || (btn && btn.contains(e.target))) return;
        ov.classList.remove('pin-more-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', close, true);
      };
      // next tick so this very click doesn't immediately close it
      setTimeout(function () { document.addEventListener('click', close, true); }, 0);
    }
  };
  window._pinIdentifyItems = async function () {
    if (PIN._busy || _autoReadBusy) { _pinBusyBounce(); return; }
    if (!_pinUnreadTodo().length) { showToast('Nothing waiting to be read', 2600); return; }
    await _pinAutoRead();
    try { _updateIdentifyBtn(); } catch (e) {}
  };

  async function _pinAutoRead() {
    if (_autoReadBusy || !PIN._groups.length) return;
    var todo = _pinUnreadTodo();
    if (!todo.length) return;
    _autoReadBusy = true; _autoReadAbort = false;
    if (!(await _tessGet())) { _autoReadBusy = false; return; }   // OCR unavailable → leave for paid identify
    // v0.9.1106 (Brad: "be nice to say check back in 24 minutes or around
    // 5:45"): after a few photos the average pace is known, so the status
    // line carries a time estimate and a finish time. Recomputed every photo,
    // so it self-corrects as easy and stubborn photos mix.
    var _arT0 = Date.now();
    try {
      for (var i = 0; i < todo.length && !_autoReadAbort; i++) {
        var _arEta = '';
        if (i >= 3) {
          var _per = (Date.now() - _arT0) / i;
          var _msLeft = _per * (todo.length - i);
          var _minLeft = Math.round(_msLeft / 60000);
          if (_minLeft >= 2) {
            var _dAt = new Date(Date.now() + _msLeft);
            var _hh = _dAt.getHours() % 12 || 12;
            var _mm = ('0' + _dAt.getMinutes()).slice(-2);
            _arEta = ' \u00b7 about ' + _minLeft + ' min left \u00b7 done around ' + _hh + ':' + _mm;
          } else if (_minLeft >= 1) _arEta = ' \u00b7 about a minute left';
          else _arEta = ' \u00b7 almost done';
        }
        // v0.9.1324: the Stop button was BUILT (v0.9.1135 gave _status a stopFn
        // parameter) and wired on the PAID path, but never passed here — so the
        // free read, which v0.9.1297 made the ONLY entry point and which
        // self-reports a 24-minute ETA two lines above, had no way out but a
        // reload. _pinAutoReadCancel already existed and already worked;
        // nothing called it. Machinery built on one surface, never wired to
        // its twin — the same shape as the Lens-share gap fixed in this batch.
        _status('Reading photos… ' + (i + 1) + ' of ' + todo.length + _arEta,
                window._pinAutoReadCancel);
        var fid = todo[i].fid, r = null;
        try { r = await _freeReadOne(fid); } catch (e) {}
        if (r && r.num) {
          var m = _ids(); m[fid] = { num: r.num, guess: r.matched ? 0 : 1, alts: r.alts || [], tried: 1, free: 1, raw: r.raw || '', dbg: r.dbg || null, rv: READER_VER, viaDesc: !!r.viaDesc, descOf: r.descOf || '', descWords: r.descWords || [], disagreed: r.disagreed || '' };
          _idsSave(m);
        } else {
          // v0.9.1072: remember WHY it failed, not just that it did. Stored on
          // the tried-map rather than as a suggestion, so a blank read still
          // counts as unread for the paid batch and the token button.
          var f = _freeTried(); f[fid] = { t: 1, raw: (r && r.raw) || '', dbg: (r && r.dbg) || null, rv: READER_VER }; _freeTriedSave(f);
        }
        _render();
      }
    } finally { _autoReadBusy = false; _status(''); }
  }

  // ── Full-size zoom (Brad): open the inbox photo at full resolution so you
  // can read the box label and ID it yourself. Tap the image to toggle
  // fit-to-screen vs. actual size (scroll/pan when zoomed); ✕ or tapping the
  // backdrop closes. Fetches the real Drive bytes (not the small thumbnail).
  window._pinZoomPhoto = async function (fileId) {
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    var old = document.getElementById('pin-zoom-ov'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-zoom-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100030;background:rgba(0,0,0,0.94);display:flex;align-items:center;justify-content:center;padding:0.5rem;-webkit-overflow-scrolling:touch';
    ov.innerHTML = '<div style="color:#bbb;font-size:0.9rem;font-family:var(--font-body)">Loading full photo…</div>';
    document.body.appendChild(ov);
    var url = '';
    var close = function () { try { if (url) URL.revokeObjectURL(url); } catch (e) {} try { ov.remove(); } catch (e2) {} if (window.BackStack) BackStack.pop('pin-zoom'); };
    if (window.BackStack) BackStack.push('pin-zoom', function () { try { ov.remove(); } catch (e) {} });
    var xBtn = document.createElement('button');
    xBtn.textContent = '✕';
    xBtn.style.cssText = 'position:fixed;top:12px;right:14px;z-index:2;background:rgba(0,0,0,0.55);border:none;color:#fff;font-size:1.6rem;line-height:1;cursor:pointer;border-radius:8px;padding:0.1rem 0.6rem';
    xBtn.onclick = function (e) { e.stopPropagation(); close(); };
    ov.appendChild(xBtn);
    // v0.9.1791: the backdrop close is gone — Back is already wired for this one.
    try {
      var blob = await _pinBytes(fileId);
      url = URL.createObjectURL(blob);
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.title = 'Tap to zoom in / out';
      var zoomed = false;
      var fit = function () { ov.style.display = 'flex'; ov.style.overflow = 'hidden'; img.style.cssText = 'display:block;margin:auto;max-width:100%;max-height:100%;cursor:zoom-in'; };
      var big = function () { ov.style.display = 'block'; ov.style.overflow = 'auto'; img.style.cssText = 'display:block;margin:0 auto;max-width:none;max-height:none;cursor:zoom-out'; };
      img.onclick = function (e) { e.stopPropagation(); zoomed = !zoomed; if (zoomed) big(); else fit(); };
      ov.innerHTML = '';
      ov.appendChild(xBtn);
      ov.appendChild(img);
      fit();
    } catch (e) {
      ov.innerHTML = '';
      ov.appendChild(xBtn);
      var msg = document.createElement('div');
      msg.style.cssText = 'color:#f88;font-family:var(--font-body);text-align:center;padding:1rem';
      msg.textContent = 'Could not load the full photo — ' + ((e && e.message) || 'try again');
      ov.appendChild(msg);
    }
  };

  // v0.9.913 (Brad): desktop split-view helpers. Load the big right-hand photo
  // at full resolution (thumbnail first for an instant preview, then sharpen),
  // and switch which photo is featured when a strip thumb is clicked.
  window._pinRvLoadFull = async function (img, fid) {
    if (!img || !fid) return;
    try { if (typeof loadDriveThumb === 'function') loadDriveThumb(fid, img, img.parentElement, PIN._thumbLink[fid] || null, 'hi'); } catch (e) {}
    // v0.9.1705: ON A PHONE THE BIG PICTURE IS A SHARPER THUMBNAIL, NOT THE
    // ORIGINAL. The crop-flash recorder's one 1141ms frame was a 12MP camera
    // JPEG being decoded to fill a 360px-wide box. Drive serves its preview at
    // any size, so the phone asks for 1200px — plenty for a phone screen at
    // 3x — and never touches the full file here. Zoom and crop fetch the
    // original themselves, when the user actually asks for it. A photo marked
    // force-fresh (cropped this session) already loaded its real bytes above.
    if (window.IS_MOBILE_UA) {
      try {
        if (window._rrForceFreshBytes && window._rrForceFreshBytes[fid]) return;
        var lk = PIN._thumbLink[fid] || (typeof _thumbLinkCache !== 'undefined' ? _thumbLinkCache[fid] : '') || '';
        if (!lk) return;
        var sharp = new Image();
        sharp.onload = function () { if (img.getAttribute('data-rvbig') === fid) img.src = sharp.src; };
        sharp.src = lk.replace(/=s\d+(-c)?$/, '=s1200');
      } catch (e) { /* keep the thumbnail */ }
      return;
    }
    try {
      if (!_qcToken()) return;
      var blob = await _pinBytes(fid);
      var u = URL.createObjectURL(blob);
      if (img.getAttribute('data-rvbig') === fid) img.src = u;   // still the current main
    } catch (e) { /* keep the thumbnail */ }
  };
  // ── v0.9.1448 (Brad): "We need to add the tagged info on the picture."
  // The photo's OWN stamps — era, scale, group kind, role, type — in one
  // line on the card. These are what Brad tagged, not what any reader
  // guessed — so a guess of HO on a photo stamped O is visibly absurd
  // instead of silently believed.
  function _pinTagLineHtml(fid) {
    try {
      var f = null;
      (PIN._groups || []).some(function (g) {
        return (g.files || []).some(function (x) { if (x.id === fid) { f = x; return true; } return false; });
      });
      if (!f) return '';
      var m = _pinMetaOf(f);
      var bits = [];
      if (m.era) bits.push(_pinEraLabel(m.era));
      if (m.type) bits.push('type ' + m.type);
      if (m.kind && m.kind !== 'single') bits.push(_pinKindLabel(m.kind));
      if (m.role && m.kind) {
        var rl = _pinRoleLabel(m.kind, m.role);
        if (rl) bits.push(rl);
      }
      if (!bits.length) return '';
      return '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--text-dim)">Picture tagged: '
        + bits.map(function (b) { return '<span style="color:var(--text-mid);font-weight:600">' + rrEsc(String(b)) + '</span>'; }).join(' · ')
        + '</div>';
    } catch (e) { return ''; }
  }
  // v0.9.1705: the current photo's thumb — on the rail or in its view-slot
  // box — wears the accent outline, so "which one is the big picture" is
  // answered at a glance on both layouts. Purely visual; nothing reads it.
  function _pinRvMarkCurrent(fid) {
    var ov = document.getElementById('pin-review-ov');
    if (!ov) return;
    ov.querySelectorAll('[data-dragfid]').forEach(function (d) {
      d.style.borderColor = d.getAttribute('data-dragfid') === fid ? 'var(--accent)' : 'transparent';
    });
    ov.querySelectorAll('[data-slotpic]').forEach(function (d) {
      d.style.outline = d.getAttribute('data-slotpic') === fid ? '2px solid var(--accent)' : '';
      d.style.outlineOffset = '1px';
    });
  }
  window._pinRvSetMain = function (fid) {
    var img = document.getElementById('pin-rv-main');
    if (!img) return;
    // ── v0.9.1448 (Brad): "i put the item number in here... when i click
    // forward and then back, its gone." The box follows each photo (v0.9.1171),
    // but what he TYPED was never saved to the photo he was leaving, so the
    // sync threw it away. Save it to that photo's record first, then switch —
    // coming back restores it, and Add files it. An emptied box does NOT wipe
    // a stored read — clearing by accident must not destroy an answer.
    try {
      var _prevFid = img.getAttribute('data-rvbig') || '';
      var _boxEl0 = document.getElementById('pin-rv-num');
      if (_prevFid && _prevFid !== fid && _boxEl0) {
        var _typed = String(_boxEl0.value || '').trim();
        var _all = _ids();
        var _prevRec = _all[_prevFid] || {};
        // v0.9.1960: compare with what the box was SHOWING (a borrowed group
        // number is not something typed, and must not become this photo's own)
        var _shown = (_pinRecFor(_prevFid).rec || {}).num || '';
        if (_typed && _typed !== String(_shown)) {
          _prevRec.num = _typed;
          _prevRec.userTyped = 1;
          _all[_prevFid] = _prevRec;
          _idsSave(_all);
        }
      }
    } catch (eKeep) {}
    img.setAttribute('data-rvbig', fid);
    window._pinRvLoadFull(img, fid);
    try { _pinRvMarkCurrent(fid); } catch (eMk) {}   // v0.9.1705
    _pinRvNavRefresh();   // v0.9.1960: the counter follows a tapped photo too
    // v0.9.1090: the identification follows the photo. Tap the Summit car and
    // the line describes the Summit car, not the engine at the front of the
    // group.
    // v0.9.1448: ...and when THIS photo has no read of its own, the card says
    // so instead of keeping the previous photo's line — that "never blank"
    // fallback is exactly how a 6468 boxcar's record ended up describing
    // Brad's Santa Fe F3 two photos away. The tagged line always rides along.
    try {
      var line = document.getElementById('pin-rv-ailine');
      if (line) {
        var _aiH = _pinAiLine(fid)
          || '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;font-size:0.85rem;color:var(--text-dim)">Nothing read from this photo yet — type the number below if you can see it, or re-scan.</div>';
        line.innerHTML = _aiH + _pinTagLineHtml(fid);
      }
    } catch (e) {}
    // v0.9.1171 (Brad's six-photo group): stepping to photo 2 moved the read line
    // to "No. 6560" while the panel beside it still read "Item # 6464-525 —
    // Minneapolis & St. Louis Boxcar", and the number box still held 6464-525.
    // v0.9.1090 taught the read LINE to follow the photo and stopped there, so
    // the other two things describing that photo went on describing the one he
    // had just left — and the Add button would have filed the wrong item.
    //
    // Three elements describe one photo. All three follow it.
    try {
      var _e = _pinRecFor(fid).rec || {};   // v0.9.1960: a one-item group keeps its number
      var _num = _e.num ? String(_e.num) : '';
      var _box = document.getElementById('pin-rv-num');
      PIN._rvAiMfr = _e.mfr || '';          // the maker hint belongs to this photo too
      PIN._rvAiRec = _e || null;            // v0.9.1419: so does the conflict check's record
      if (_box) _box.value = _num;
      if (typeof window._pinReviewLookup === 'function') window._pinReviewLookup(_num);
    } catch (eSync) {}
  };

  // ── Crop / Rotate an inbox photo IN PLACE (v0.9.899, Brad) ───
  // Same tool + same replace-the-Drive-bytes pattern Quick Capture uses
  // (photo-crop.js _openCropper → Drive media PATCH). Every thumbnail
  // refreshes, and re-running Identify reads the cleaned-up shot —
  // cropping to the item gives the AI the same edge the wizard's crop
  // step gives it.
  window._pinCropPhoto = async function (fid) {
    if (typeof window._openCropper !== 'function' || typeof Cropper === 'undefined' || typeof window._cropOpenDriveFile !== 'function') { showToast('Crop tool still loading — try again in a moment', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    // v0.9.1872: through the ONE Drive-aware crop screen (photo-crop.js
    // _cropOpenDriveFile) instead of a private copy of the Drive write. The
    // original is protected before anything is overwritten, a photo cropped
    // before opens on its ORIGINAL with the crop drawn, and Restore original is
    // offered. The current bytes are fetched only when they are needed — by
    // _pinBytes, whose failure wording (v0.9.1738) stays exactly as it was.
    await window._cropOpenDriveFile(fid, {
      src: async function () {
        try {
          var blob0 = await _pinBytes(fid);
          return URL.createObjectURL(blob0);
        } catch (e) {
          // v0.9.1443: this step READS the photo — nothing is written until the
          // crop is applied, so "could not save" described a save that never
          // happened and left Brad wondering if the picture was damaged. Say what
          // actually failed, say the photo is untouched, and give advice that works.
          var _m = String((e && e.message) || e || '');
          // v0.9.1738: three honest answers instead of one wrong one. A rate limit
          // has already been retried three times by _pinBytes before it gets here;
          // "sign-in expired" is now said only when the token really has lapsed.
          var _say;
          if (/SESSION_EXPIRED/.test(_m)) {
            _say = 'Your sign-in expired — refresh the page, then crop again. Your photo is untouched.';
          } else if (/rate limit/i.test(_m)) {
            _say = 'Google Drive is asking us to slow down — wait a moment, then crop again. Your photo is untouched.';
          } else if (/drive 403/i.test(_m)) {
            _say = 'Drive would not hand over that photo (' + _m.replace(/^drive 403 /, '').split(':')[0] + '). Your photo is untouched — check the folder is still shared with this account.';
          } else {
            _say = 'Could not open that photo for cropping. Your photo is untouched — try again.';
          }
          showToast(_say, 4800, true);
          var _said = (e && typeof e === 'object') ? e : new Error(_m);
          try { _said.rrSaid = true; } catch (eF) {}
          throw _said;
        }
      },
      onDone: function (ok, blob, kind) {
        if (!ok) { showToast('Could not save the crop — the original is untouched', 3500, true); return; }
        try {
          // Bust the shared thumbnail cache so every view shows the new bytes.
          // (The writer healed drive.js's caches already — rrPhotoBytesChanged —
          // and marked the photo cropped; these are the inbox's own copies.)
          var fresh = URL.createObjectURL(blob);
          try {
            if (typeof _blobCache !== 'undefined') {
              if (_blobCache[fid]) { try { URL.revokeObjectURL(_blobCache[fid]); } catch (e2) {} }
              _blobCache[fid] = fresh;
            }
          } catch (e3) {}
          try { if (typeof _thumbLinkCache !== 'undefined') delete _thumbLinkCache[fid]; } catch (eTL) {}
          // Update every on-screen copy incl. the review modal's main image (data-rvbig).
          document.querySelectorAll('img[data-rvfid="' + fid + '"], img[data-fid="' + fid + '"], img[data-ppfid="' + fid + '"], img[data-rvbig="' + fid + '"]').forEach(function (im) { im.src = fresh; });
          // v0.9.1297 (Brad): the crop CLEARS the old read (a number lifted off
          // the uncropped frame is exactly the read to replace) but no longer
          // re-reads on the spot — reads run when he hits Identify my items,
          // after all the cropping, tagging and grouping is done. The cleared
          // read makes this photo count as unread, so the button picks it up.
          try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (eA) {}
          // v0.9.1771 — and clear it on the PHOTO, or the next load pulls the old
          // number straight back down: this device would have no read, Drive would
          // still hold one, and the sync would helpfully re-seed exactly the answer
          // the crop was meant to throw away.
          try { _pinMetaSet(fid, { num: null, conf: null, rt: String(Date.now()) }); } catch (eN) {}
          try { var ff = _freeTried(); if (ff[fid]) { delete ff[fid]; _freeTriedSave(ff); } } catch (eB) {}
          // v0.9.1705 (Brad: "what is the 'it will be read fresh' comment that
          // flashes up. i don't think that is needed"): just the confirmation.
          // The rule behind the old wording still holds — the crop CLEARS the
          // old read (two lines up) and does NOT read on the spot; Identify my
          // items picks the photo up as unread.
          if (kind === 'restore') showToast('Original restored \u2713', 2000);
          else showToast('Cropped \u2713', 2000);
          try { _render(); } catch (eC) {}
          try { _updateIdentifyBtn(); } catch (eD) {}
        } catch (e4) { showToast('Could not refresh the photo on screen — reopen the inbox to see the change', 3000, true); }
      },
    });
  };

  // v0.9.1297 (Brad): the "Re-read cropped" button and its machinery
  // (_pinCroppedGroups / _updateRecropBtn / _pinReadCropped, v0.9.1058) are
  // GONE — with reads running on demand, cropping happens BEFORE the first
  // read, and a crop that comes after one clears the stale read anyway, so
  // the cropped photo is simply unread again and Identify my items covers
  // it. One button, one waiting-list (_pinUnreadTodo), one loop.

  // (Image preparation for the number reader → app/photo-inbox-reader.js, split step 3.)



  window._pinIdentifyAll = async function () {
    if (PIN._busy) { _pinBusyBounce(); return; }
    if (!_pinAr()) return;   // v0.9.1927: paid read — beta feature
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var ids = _ids();
    // v0.9.1340: the type gate matters MOST here — this button spends a real
    // photo ID per item. Paper / Catalog / Other are held back; ticking one and
    // pressing Identify still reads it.
    var _allTodo = PIN._groups.filter(function (g) { return !_pinRecFor(_pinReadFid(g)).rec; });   // v0.9.1960: a group identified on any photo is not read again
    var todo = _allTodo.filter(function (g) { return !_pinSkipBatchGroup(g); });
    var _held = _allTodo.length - todo.length;
    if (!todo.length) {
      showToast(_held
          ? _held + ' photo' + (_held === 1 ? ' is' : 's are') + ' tagged Paper, Catalog or Other, so ' + (_held === 1 ? 'it is' : 'they are') + " not read in a batch — tick one and press Identify to read it anyway"
          : (PIN._groups.length ? 'Every item already has a suggestion — tick photos and use Identify to re-run any of them' : 'Inbox is empty'),
        _held ? 6000 : 3500);
      return;
    }
    // v0.9.956 (Brad): free auto-read already tried these — this button only
    // targets the leftovers it couldn't place. Show the exact count and make
    // clear it uses paid reads, so a batch never spends credits by surprise.
    var n = todo.length;
    // v0.9.1920 (camera list #5): the list counts photos with no number yet —
    // including ones the free read never saw — so no "already tried" claim.
    var msg = '<b>' + n + '</b> item' + (n === 1 ? '' : 's') + (n === 1 ? ' doesn\'t' : ' don\'t') +
      ' have a number yet. Read ' + (n === 1 ? 'it' : 'them') +
      ' now with photo IDs? This uses ' + n + ' of your photo ID' + (n === 1 ? '' : 's') + ' (1 per item). '
      + 'Tip: <b>Identify my items</b> is free \u2014 try it first.'
      + (_held ? ' <b>' + _held + '</b> more ' + (_held === 1 ? 'is' : 'are') + ' tagged Paper, Catalog or Other and ' + (_held === 1 ? 'is' : 'are') + " not in this batch — you can still read " + (_held === 1 ? 'it' : 'them') + ' one at a time.' : '');
    // The message above already states the cost; repeating "(44 tokens)" on the
    // button is the same ambiguity as the toolbar had — it reads like a balance.
    var go = await _pinConfirm(msg, '🔍 Read ' + n + ' item' + (n === 1 ? '' : 's'));
    if (!go) return;
    return _pinIdentifyRun(todo, ids);
  };

  // v0.9.897 (Brad): identify JUST the ticked photos — and unlike Identify
  // all, it ALWAYS re-identifies, even when a suggestion already exists.
  // That's the point: re-run a blank or wrong read with one click.
  window._pinIdentifySelected = async function () {
    if (PIN._busy) { _pinBusyBounce(); return; }
    if (!_pinAr()) return;   // v0.9.1927: paid read — beta feature
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var gs = _selGroups();
    if (!gs.length) { showToast('Tick the corner circle on the photos you want identified first', 3000, true); return; }
    // v0.9.1135: this used to delete every ticked read and save that IMMEDIATELY,
    // then start spending — with no confirmation at all. Tick 40 photos, press
    // Identify, press Stop after the first, and 39 reads were gone with nothing
    // bought to replace them. Its sibling (_pinIdentifyAll, just above) has always
    // confirmed properly. Now this one does too, and the old reads are not cleared
    // until the user has said yes.
    var n0 = gs.length;
    var had = 0;
    var ids = _ids();
    gs.forEach(function (g) { if (ids[_pinReadFid(g)]) had++; });
    var msg0 = 'Read ' + n0 + ' ticked photo' + (n0 === 1 ? '' : 's') + '? '
      + 'This uses ' + n0 + ' of your photo ID' + (n0 === 1 ? '' : 's') + ' (1 per item).';
    if (had) {
      msg0 += ' <b>' + had + '</b> of them already ' + (had === 1 ? 'has a reading' : 'have readings')
        + ' — ' + (had === 1 ? 'it' : 'they') + ' will be replaced.';
    }
    var go0 = await _pinConfirm(msg0, '🔍 Read ' + n0 + ' item' + (n0 === 1 ? '' : 's'));
    if (!go0) return;
    gs.forEach(function (g) { delete ids[_pinReadFid(g)]; });   // clear old suggestions = force fresh reads
    _idsSave(ids);
    return _pinIdentifyRun(gs, ids);
  };
  // (→ app/photo-inbox-identify.js, split step 7: moved word for word.)
  // Every "still working on the last batch" guard in this file used to end
  // the story at a red toast naming a batch the collector could not see and
  // had not started. When the picker wait is the thing holding the lock, say
  // that instead, and put the way out back on screen.
  // v0.9.1418: order matters. Wedged is checked FIRST — a job that has not
  // moved in two minutes is not "still working", and telling someone to wait
  // for it is the thing that cost Cooper half an hour.
  function _pinBusyBounce() {
    if (_pinStuckStatus()) {
      showToast((_busyWhat || 'The last job') + ' is stuck — use Restart the app on the line above', 5000, true);
    } else if (_pinGPStatus()) {
      showToast('Still waiting on Google Photos — press Cancel on the line above to stop waiting', 4500, true);
    } else {
      // Name the job. "Still working on the last batch" meant nothing to a
      // collector who had not knowingly started a batch.
      showToast(_busyWhat ? ('Still working: ' + _busyWhat.toLowerCase() + '…') : 'Still working on the last batch…', 2500, true);
    }
  }
  // (→ app/photo-inbox-identify.js, split step 7: moved word for word.)

  // ── Badges + dashboard cards (v0.9.890) ──────────────────────
  var COUNT_KEY = 'rr_inbox_count';
  // (→ app/photo-inbox-identify.js, split step 7: moved word for word.)
  // v0.9.1704: the inbox watcher. Idle until signed in and the inbox (or the
  // dashboard's inbox card) is on screen; never started on a phone.
  try { _pinWatchStart(); } catch (e) {}

  // Fixed settings handed over to the other pieces — VALUES, so here at the very
  // end, once every one is set; the pieces after this one take them as they load.
  Object.assign(PINF, { _PIN_SHEET_OV: _PIN_SHEET_OV, READER_VER: READER_VER, RR_READ_STEPS: RR_READ_STEPS, SETSTAGE_KEY: SETSTAGE_KEY, PENDING_KEY: PENDING_KEY, CROPPED_KEY: CROPPED_KEY, _PIN_KINDS: _PIN_KINDS, _PIN_TYPES: _PIN_TYPES, COUNT_KEY: COUNT_KEY });
})();
