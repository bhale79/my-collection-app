// ═══════════════════════════════════════════════════════════════
// photo-inbox.js — Photo Inbox ("Lazy Mode" Phase 1) — v0.9.879
//
// SELF-CONTAINED & REMOVABLE (same rule as show-mode.js):
//   • This file is the ENTIRE feature. To remove it, delete the
//     <script src="photo-inbox.js"> tag from index.html, remove the
//     sw.js precache line, and bump versions.
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
  var _groups = [];          // [{ key, files:[{id,name,createdTime}] }]
  var _sel = {};             // groupKey -> true
  var _thumbLink = {};       // v0.9.1326: fileId -> thumbnailLink, from the listing
  var _selectMode = false;   // true while EITHER selection mode is running
  // v0.9.1057 (Brad): "Select multiple" said nothing about what it was for, so
  // the two things people actually do — put photos together, and say what they
  // are — had no front door. Two named buttons now, one selection mechanic.
  var _rvKey = '';           // group key the review card is open on ('' = multi-select)
  // v0.9.1307 (Brad: "i selected a filter for not scanned, and there is no
  // next or previous arrows"): the arrows walked the LIVE filtered list, so
  // the moment a card was read it fell out of a not-read filter, its index
  // came back -1, and the arrows vanished — on exactly the workflow the
  // filter exists for. The walking order is now SNAPSHOTTED when the card
  // opens (group keys — stable identifiers) and released when it closes.
  var _rvOrderKeys = null;
  var _selPurpose = '';      // '' | 'group' | 'tag'  — what Apply does
  var _tagEra = '';          // era picked in tag mode, written on Apply
  var _tagType = '';         // v0.9.1297: item type picked in tag mode ('' = leave as-is)
  // The Type choices the tag bar offers. 'Paper' and 'Catalog' matter most —
  // they stop a blueprint being searched as a locomotive.
  var _PIN_TYPES = ['Engine', 'Tender', 'Boxcar', 'Flatcar', 'Gondola', 'Tank Car', 'Hopper',
                    'Caboose', 'Passenger Car', 'Accessory', 'Building', 'Track', 'Set',
                    'Paper', 'Catalog', 'Other'];
  // A shooting session. The context bar used to sit on the page permanently;
  // Brad only wants it while he is actually shooting. It appears when a session
  // starts, and Done ends it. Deliberately NOT persisted: a stale "Lionel
  // Postwar" left armed a week later is how forty cars get mis-stamped.
  var _pinSession = false;
  var _sessionEra = '';      // the session's home era (memory only)
  var _busy = false;

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
    _busy = !!on;
    if (on) {
      _busySince = _busyProgressAt = Date.now();
      _busyWhat = what || '';
    } else {
      _busySince = _busyProgressAt = 0;
      _busyWhat = '';
    }
  }
  function _busyStuck() {
    return _busy && !!_busyProgressAt && (Date.now() - _busyProgressAt) > _STUCK_MS;
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
      try {
        var chk = await driveRequest('GET', '/files/' + cached + '?fields=id,trashed');
        if (chk && chk.id && !chk.trashed) { _fid = cached; _fidChecked = true; return _fid; }
      } catch (e) {}
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
        '<div id="pin-help-text" style="display:none;font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.6rem">Drop photos anywhere below, or use Add photos. Get them ready at your own pace \u2014 crop, use \u201cGroup photos\u201d to put several shots of one item together, and \u201cTag maker/era/scale/type\u201d to say what photos are \u2014 then hit <b>Identify my items</b> to read them all. Photos you have tagged <b>Paper</b>, <b>Catalog</b> or <b>Other</b> are left out of that batch \u2014 there is rarely an item number to find on a drawing or a catalogue page, and on the paid read it would spend a photo ID for nothing. You can always tick any single photo and press Identify to read it anyway. Click a photo to review it \u2014 add the item, research it more, or discard the photo. Photos snapped with Quick Capture on your phone land here too.</div>' +
        '<div id="pin-context-bar" style="display:none"></div>' +   // v0.9.1048 capture context
        '<div id="pin-tagbar" style="display:none"></div>' +        // v0.9.1057 tag mode
        '<div id="pin-toolbar" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center">' +
          // Identify is what this page is FOR, so it is the one solid button
          // (v0.9.1340, Brad: "don't like the yellow color on the photo reader
          // buttons"). Add photos steps back to an outline beside it.
          '<button id="pin-identify-btn" class="btn-primary" onclick="_pinIdentifyItems()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Identify my items</button>' +
          '<button id="pin-add-photos" onclick="_pinAddSource()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Add photos\u2026</button>' +
          '<button id="pin-group-btn" onclick="_pinStartMode(\'group\')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Group photos</button>' +
          '<button id="pin-tag-btn" onclick="_pinStartMode(\'tag\')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Tag maker/era/scale/type</button>' +
          // The filter menu renders in here — one control that NAMES what is
          // active, in place of eight chips (v0.9.1051) that did not fit.
          '<span id="pin-filter-row" style="display:none"></span>' +
          '<button id="pin-apply-btn" onclick="_pinApplyTags()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Apply</button>' +
          '<button id="pin-finish-btn" onclick="_pinFinishMode()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">\u2713 Finished</button>' +
          '<button id="pin-selall-btn" onclick="_pinSelectAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Select all</button>' +
          // v0.9.1297 (Brad): reads run when HE says so \u2014 crop, tag and group
          // first, then this button. v0.9.1340 moved the paid read onto the
          // standard outline so free and paid never look alike at a glance.
          // v0.9.1411 (Brad, mobile): on a phone this paid read moves into the
          // "\u22ef More" menu so the toolbar fits two rows and the photos show.
          // On desktop #pin-overflow is display:contents, so the button flows
          // into the row exactly as before and #pin-more-btn stays hidden \u2014
          // nothing about the desktop layout changes.
          '<button id="pin-more-btn" onclick="_pinToggleMore(event)" aria-haspopup="true" aria-expanded="false" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">\u22ef More</button>' +
          '<span id="pin-overflow">' +
          '<button id="pin-idall-btn" onclick="_pinIdentifyAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">\ud83d\udd0d Read the unread</button>' +
          '</span>' +
          '<span style="flex:1"></span>' +
          '<span id="pin-selinfo" style="font-size:0.78rem;color:var(--text-dim)"></span>' +
          '<button id="pin-idsel-btn" onclick="_pinIdentifySelected()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Read these</button>' +
          '<button id="pin-assign-btn" onclick="_pinReview(null)" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Combine \u2192 one item\u2026</button>' +
          '<button id="pin-discard-btn" onclick="_pinDiscard()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Discard</button>' +
          // v0.9.1352 (Brad): the Reader audit is gone, which left a \u22ef menu
          // holding one row. Refresh is now a plain button. FOUR status
          // messages tell the user to "hit Refresh" \u2014 a partial listing, a
          // failed discard, a failed filing, a failed load \u2014 so the control
          // they are being sent to should be visible, not one tap inside a menu.
          '<button id="pin-refresh-btn" onclick="_pinRefresh()" title="Re-read the inbox folder from Google Drive" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Refresh</button>' +
        '</div>' +
        '<div id="pin-skipnote" style="display:none;font-size:0.78rem;color:var(--text-dim);margin:0.5rem 0 0"></div>' +
        '<div id="pin-status" style="display:none;font-size:0.8rem;color:var(--text-dim);margin:0.5rem 0 0"></div>' +
      '</div>' +
      '<div id="pin-drop" style="min-height:50vh;border:2px dashed var(--border);border-radius:12px;padding:0.8rem;margin-top:0.8rem">' +
        '<div id="pin-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.6rem"></div>' +
        '<div id="pin-empty" style="display:none;text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:0.95rem;margin-bottom:0.3rem;font-weight:600">Inbox is empty</div><div style="font-size:0.8rem">Drag photos here from any folder, or click Add photos.</div></div>' +
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
      var files = Array.prototype.filter.call((e.dataTransfer || {}).files || [], function (f) { return /^image\//.test(f.type); });
      if (files.length) _upload(files);
      else showToast('No image files in that drop', 2500, true);
    });
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
    if (msg && _busy) _busyProgressAt = Date.now();
    if (!el) return;
    if (msg) {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '0.45rem';
      el.style.color = '#2980b9';        // bright blue = "working"
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
    return body.length ? body : g.files.slice();
  }
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
    if (!_pinFilter.status && !_pinFilter.era && !_pinFilter.kind) return _groups;
    return _groups.filter(_pinGroupPasses);
  }
  function _pinFilterActive() { return !!(_pinFilter.status || _pinFilter.era || _pinFilter.kind); }

  // Counts so a chip can say what is behind it before you tap.
  function _pinCounts() {
    var st = {}, era = {}, kind = {};
    _groups.forEach(function (g) {
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
      + 'background:var(--bg-card);color:' + (active ? 'var(--accent)' : '#2980b9') + ';font-family:var(--font-body);'
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
      roles:[['engine','Engine'],['tender','Tender'],['boxcar','Boxcar'],['flatcar','Flatcar'],
             ['gondola','Gondola'],['tank','Tank Car'],['hopper','Hopper'],['caboose','Caboose'],
             ['passenger','Passenger Car'],['member','Other piece'],
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
  if (typeof window !== 'undefined') {
    window._pinKinds = function () { return _PIN_KINDS; };
    window._pinDefaultRoles = _pinDefaultRoles;
    window._pinKindLabel = _pinKindLabel;
  }

  // "Group as…" — takes the ticked photos, gives them one group id, a kind and
  // a role each, and writes all of it to the Drive files.
  // ══ v0.9.1297 (Brad): grouping is a FLOATING PANEL, not a pop-over. ══════
  // "so i hit group photos, i select two or more photos, those thumbnails
  //  appear on a samll grid on the popup, and the i select what type they
  //  are, and hit an apply button. then i can select another group. I can
  //  scroll up and down and the pop up stays on the top right of the screen.
  //  there will also be a cancel and done button."
  //
  // The panel pins to the top-right (bottom of the screen on phones), fills
  // live as photos are ticked, and STAYS through Apply so the next group is
  // two taps away. Saving is the same v0.9.1050 machinery — one group id, a
  // kind, a role per photo — extracted into _pinGroupApply below so the old
  // dialog's behavior survives with a different roof over it.
  var _grpPanelKind = 'aba';
  var _grpPanelRoles = [];

  // The one writer for "make these photos a group" (was the dialog's save).
  // Returns {blocked:'detail'} without saving when the first photo is marked
  // as a detail shot — a detail chains to the photo ABOVE it, and the first
  // photo has nothing above.
  async function _pinGroupApply(files, kindId, roles, onProgress) {
    if (roles && roles[0] === 'detail') return { blocked: 'detail', ok: 0, total: files.length };
    var gid = 'G' + Date.now().toString(36);
    var okAll = 0;
    for (var i = 0; i < files.length; i++) {
      var ok = await _pinMetaSet(files[i].id, { grp: gid, kind: kindId, role: (roles && roles[i]) || '' });
      if (ok) okAll++;
      if (onProgress) { try { onProgress(i + 1, files.length); } catch (e) {} }
    }
    return { ok: okAll, total: files.length };
  }

  // ══ v0.9.1340 — grouping must not DESTROY a group by surprise ════════════
  // Brad tried to pull his already-made "Engine + tender · 3" tile into a train
  // set. Selection works on whole GROUPS, not photos, so that tap would have
  // dragged all three photos into the new set, minted a fresh id over them and
  // overwritten their kind and roles — the pairing gone, silently, with Split
  // apart as the only way back. The grouping itself is unchanged; it just says
  // so first.
  function _pinExistingGroupsIn(files) {
    var byGrp = {}, out = [];
    (files || []).forEach(function (f) {
      var g = (((f && f._meta) || {}).grp) || '';
      if (!g) return;
      (byGrp[g] = byGrp[g] || []).push(f);
    });
    Object.keys(byGrp).forEach(function (k) {
      if (byGrp[k].length > 1) {
        out.push({ grp: k, n: byGrp[k].length, kind: ((byGrp[k][0]._meta) || {}).kind || '' });
      }
    });
    return out;
  }
  // Re-tagging ONE existing group as itself is not a dissolve — no warning for
  // the commonest legitimate case (fixing the kind you picked last time).
  function _pinDissolveWarning(files, kindLabelOf) {
    var ex = _pinExistingGroupsIn(files);
    if (!ex.length) return '';
    if (ex.length === 1 && ex[0].n === (files || []).length) return '';
    var bits = ex.map(function (e) {
      var lbl = kindLabelOf ? kindLabelOf(e.kind) : e.kind;
      return '<b>' + (lbl || 'a group') + '</b> (' + e.n + ' photos)';
    });
    return 'This will break up ' + (ex.length === 1 ? 'an existing group' : ex.length + ' existing groups')
      + ' — ' + bits.join(' and ') + ' — and fold '
      + (ex.length === 1 ? 'its photos' : 'their photos') + ' into the new one. Continue?';
  }
  if (typeof window !== 'undefined') {
    window._pinExistingGroupsIn = _pinExistingGroupsIn;
    window._pinDissolveWarning = _pinDissolveWarning;
  }

  function _pinGrpPanelFiles() {
    var files = [];
    _selGroups().forEach(function (g) { g.files.forEach(function (f) { files.push(f); }); });
    return files;
  }

  function _pinGrpPanelClose() {
    var p = document.getElementById('pin-grp-panel');
    if (p) p.remove();
  }

  function _pinGrpPanelRender() {
    if (_selPurpose !== 'group') { _pinGrpPanelClose(); return; }
    var files = _pinGrpPanelFiles();
    var k = _pinKind(_grpPanelKind);
    _grpPanelRoles = _grpPanelRoles.slice(0, files.length);
    while (_grpPanelRoles.length < files.length) {
      var d = _pinDefaultRoles(_grpPanelKind, files.length);
      _grpPanelRoles.push(d[_grpPanelRoles.length] || (k.roles.length ? k.roles[k.roles.length - 1][0] : ''));
    }
    var p = document.getElementById('pin-grp-panel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'pin-grp-panel';
      document.body.appendChild(p);
    }
    // Top-right on a desktop; docked to the bottom on a phone, where a fixed
    // right-hand card would sit on top of the grid being picked from.
    var narrow = (window.innerWidth || 0) < 700;
    p.style.cssText = narrow
      ? 'position:fixed;left:0;right:0;bottom:0;z-index:10040;background:var(--surface);border-top:2px solid var(--accent2);box-shadow:0 -4px 18px var(--scrim);padding:0.7rem 0.8rem;max-height:45vh;overflow-y:auto'
      : 'position:fixed;top:70px;right:16px;width:300px;z-index:10040;background:var(--surface);border:1.5px solid var(--accent2);border-radius:12px;box-shadow:0 6px 22px var(--scrim);padding:0.75rem 0.85rem;max-height:72vh;overflow-y:auto';
    var html =
      '<div style="font-family:var(--font-head);font-size:0.95rem;font-weight:700;margin-bottom:0.15rem">Group photos</div>'
      + '<div style="font-size:0.74rem;color:var(--text-dim);line-height:1.45;margin-bottom:0.55rem">Tap photos in the grid — they collect here. An AA, AB or ABA saves as separate items that stay linked. A set shot of everything together becomes the group\'s cover picture, and is never read for a number \u2014 it has several.' + ' In a train set, a photo showing a PAIR (engine + tender, AA, AB, ABA) files with the set\'s engine instead of becoming its own item. A paper or other collectible stays one item however many shots. Tap a thumbnail to see it full size.</div>'
      + (files.length
          ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:0.35rem;margin-bottom:0.6rem">'
            + files.map(function (f, i) {
                return '<div onmousedown="event.preventDefault()" onclick="event.stopPropagation();_pinZoomPhoto(\'' + f.id + '\')" title="Open this photo full size" style="position:relative;aspect-ratio:1;border-radius:6px;overflow:hidden;background:var(--surface2);cursor:zoom-in">'
                  + '<img data-gppfid="' + f.id + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'
                  + '<div style="position:absolute;left:0;bottom:0;background:var(--scrim);color:#fff;font-size:0.55rem;padding:0 3px;border-radius:0 4px 0 0">' + (i + 1) + '</div>'
                  + '</div>';
              }).join('')
            + '</div>'
          : '<div style="font-size:0.78rem;color:var(--text-dim);font-style:italic;margin-bottom:0.6rem">Nothing selected yet.</div>')
      + '<select id="pin-grp-panel-kind" style="width:100%;padding:0.5rem 0.6rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.88rem;min-height:42px;box-sizing:border-box;margin-bottom:0.55rem">'
      +   _PIN_KINDS.map(function (kk) { return '<option value="' + kk.id + '"' + (kk.id === _grpPanelKind ? ' selected' : '') + '>' + rrEsc(kk.label) + '</option>'; }).join('')
      + '</select>'
      + (k.roles.length && files.length
          ? files.map(function (f, i) {
              return '<div style="display:flex;align-items:center;gap:0.45rem;padding:0.25rem 0;border-top:1px solid var(--border)">'
                + '<div onmousedown="event.preventDefault()" onclick="event.stopPropagation();_pinZoomPhoto(\'' + f.id + '\')" title="Open this photo full size" style="width:30px;height:30px;border-radius:5px;overflow:hidden;background:var(--surface2);flex-shrink:0;position:relative;cursor:zoom-in">'
                +   '<img data-gppfid="' + f.id + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'
                +   '<div style="position:absolute;left:0;bottom:0;background:var(--scrim);color:#fff;font-size:0.5rem;padding:0 2px">' + (i + 1) + '</div>'
                + '</div>'
                + '<select data-gpri="' + i + '" class="pin-grp-panel-role" style="flex:1;min-width:0;padding:0.35rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.78rem;min-height:36px">'
                +   k.roles.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === _grpPanelRoles[i] ? ' selected' : '') + '>' + rrEsc(r[1]) + '</option>'; }).join('')
                + '</select></div>';
            }).join('')
          : (files.length ? '<div style="font-size:0.75rem;color:var(--text-dim);padding:0.25rem 0 0.45rem">All ' + files.length + ' photos will be filed as one item.</div>' : ''))
      + '<div style="display:flex;gap:0.4rem;margin-top:0.6rem">'
      +   '<button id="pin-grp-panel-apply" ' + (files.length >= 2 ? '' : 'disabled ') + 'style="flex:2;padding:0.6rem;border-radius:8px;border:none;background:' + (files.length >= 2 ? 'var(--accent)' : 'var(--surface2)') + ';color:' + (files.length >= 2 ? 'var(--on-accent)' : 'var(--text-dim)') + ';font-weight:700;font-size:0.88rem;min-height:44px;cursor:' + (files.length >= 2 ? 'pointer' : 'default') + '">Apply</button>'
      +   '<button id="pin-grp-panel-cancel" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-weight:600;font-size:0.82rem;min-height:44px;cursor:pointer">Cancel</button>'
      +   '<button id="pin-grp-panel-done" style="flex:1;padding:0.6rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-weight:700;font-size:0.82rem;min-height:44px;cursor:pointer">Done</button>'
      + '</div>';
    p.innerHTML = html;
    try {
      Array.prototype.forEach.call(p.querySelectorAll('img[data-gppfid]'), function (im) {
        loadDriveThumb(im.getAttribute('data-gppfid'), im, im.parentElement, null, 'hi');
      });
    } catch (eTh) {}
    var ks = document.getElementById('pin-grp-panel-kind');
    if (ks) ks.onchange = function () {
      _grpPanelKind = this.value;
      _grpPanelRoles = _pinDefaultRoles(_grpPanelKind, _pinGrpPanelFiles().length);
      _pinGrpPanelRender();
    };
    Array.prototype.forEach.call(p.querySelectorAll('.pin-grp-panel-role'), function (sel) {
      sel.onchange = function () { _grpPanelRoles[parseInt(this.getAttribute('data-gpri'), 10)] = this.value; };
    });
    var ap = document.getElementById('pin-grp-panel-apply');
    if (ap) ap.onclick = async function () {
      var files2 = _pinGrpPanelFiles();
      if (files2.length < 2) { showToast('Tick two or more photos first', 2800, true); return; }
      this.disabled = true; this.textContent = 'Saving…';
      var self = this;
      var _warn = _pinDissolveWarning(files2, _pinKindLabel);
      if (_warn) {
        var _goW = await _pinConfirm(_warn, 'Break up and regroup');
        if (!_goW) { self.disabled = false; self.textContent = 'Apply'; return; }
      }
      var res = await _pinGroupApply(files2, _grpPanelKind, _grpPanelRoles.slice(0, files2.length), function (done, total) {
        self.textContent = 'Saving… ' + done + '/' + total;
      });
      if (res.blocked === 'detail') {
        showToast('The first photo can\'t be a detail — mark the piece itself first, then its detail below it', 4500, true);
        self.disabled = false; self.textContent = 'Apply';
        return;
      }
      if (res.ok === res.total) showToast('Grouped as ' + _pinKindLabel(_grpPanelKind), 3000);
      else showToast('Grouped ' + res.ok + ' of ' + res.total + ' — try the rest again', 5000, true);
      // The panel STAYS — clear the ticks and the roles so the next group
      // starts clean, and refresh the grid behind it.
      _sel = {}; _grpPanelRoles = [];
      _pinGrpPanelRender();
      _pinRefresh();
    };
    var cn = document.getElementById('pin-grp-panel-cancel');
    // v0.9.1306 (Brad: "cancel button doesn't work"): with nothing ticked,
    // Cancel cleared an already-empty selection and the popup just sat there.
    // One button, both expectations: ticks present → clear them and stay for
    // the next group (and SAY so); nothing ticked → close, same as Done.
    if (cn) cn.onclick = function () {
      var _had = _pinGrpPanelFiles().length;
      _sel = {}; _grpPanelRoles = [];
      if (_had) {
        _render();
        _pinGrpPanelRender();
        showToast('Cleared — tap photos to start a new group', 2500);
      } else {
        window._pinFinishMode();
      }
    };
    var dn = document.getElementById('pin-grp-panel-done');
    if (dn) dn.onclick = function () { window._pinFinishMode(); };
  }


  window._pinConfirmUngroup = async function (key) {
    var g = null;
    _groups.forEach(function (x) { if (x.key === key) g = x; });
    if (!g || g.files.length < 2) return;
    var ok = await _pinConfirm('Split this back into ' + g.files.length
      + ' separate photos? Nothing is deleted \u2014 they just stop being one item.', 'Split apart');
    if (ok) window._pinUngroup(key);
  };

  // Break a group back into loose photos.
  window._pinUngroup = async function (key) {
    var g = null;
    _groups.forEach(function (x) { if (x.key === key) g = x; });
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
  var _pinOneShot = null;          // era key armed for the next photo only

  // v0.9.1057: the home era used to live in localStorage and survive restarts.
  // Brad's call: it clears when the session is done. A setting that outlives the
  // shelf you were photographing is a trap, not a convenience — you come back
  // next week, shoot MTH, and it all lands as Lionel Postwar.
  function _pinHomeEra() { return _sessionEra || ''; }
  function _pinSetHomeEra(era) { _sessionEra = era || ''; }
  // What the next photo will be stamped with.
  function _pinActiveEra() { return _pinOneShot || _pinHomeEra(); }

  function _pinEraLabel(era) {
    if (!era) return 'Not set';
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
    if (!_pinSession) { el.style.display = 'none'; return; }
    var era = _pinActiveEra();
    var armed = !!_pinOneShot;
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
        + 'color:' + (known ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-head);font-weight:700;font-size:0.9rem;cursor:pointer">'
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
    _pinSession = false;
    _pinOneShot = null;
    _sessionEra = '';
    var el = document.getElementById('pin-context-bar');
    if (el) el.style.display = 'none';
  };

  window._pinClearOneShot = function () { _pinOneShot = null; _pinRenderBar(); };

  // Three dropdowns that narrow each other: maker → scale → line.
  // opts (all optional) — when opts.onPick is given the sheet shows ONE confirm
  // button and hands the era back instead of arming the capture bar. That is
  // how tag mode and the start-of-session prompt reuse this same picker rather
  // than growing a second copy of the maker/scale/line logic.
  window._pinPickContext = function (opts) {
    opts = opts || {};
    var choices = _pinEraChoices();
    if (!choices.length) { showToast('No manufacturers configured yet', 2500, true); return; }
    var cur = opts.current || _pinActiveEra();
    var curDef = choices.filter(function (c) { return c.key === cur; })[0] || null;
    var pick = { maker: curDef ? curDef.maker : '', scale: curDef ? curDef.scale : '', era: cur || '' };

    var ov = document.createElement('div');
    ov.id = 'pin-ctx-sheet';
    ov.style.cssText = _PIN_SHEET_OV;
    var card = document.createElement('div');
    card.style.cssText = _pinSheetCardCss(520, 82);
    ov.appendChild(card);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    function uniq(a) { var s2 = {}, o = []; a.forEach(function (v) { if (v && !s2[v]) { s2[v] = 1; o.push(v); } }); return o.sort(); }

    function draw() {
      var makers = uniq(choices.map(function (c) { return c.maker; }));
      if (!pick.maker && makers.indexOf('Lionel') >= 0) pick.maker = 'Lionel';
      var scaleSet = choices.filter(function (c) { return c.maker === pick.maker; });
      var scales = uniq(scaleSet.map(function (c) { return c.scale; }));
      if (scales.indexOf(pick.scale) < 0) pick.scale = scales.length === 1 ? scales[0] : '';
      var lines = scaleSet.filter(function (c) { return !pick.scale || c.scale === pick.scale; });
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
        + sel('pin-ctx-maker', 'Manufacturer', makers.map(function (m) { return { v: m, t: m }; }), pick.maker, '')
        + (scales.length > 1 ? sel('pin-ctx-scale', 'Scale', scales.map(function (m) { return { v: m, t: m }; }), pick.scale, '') : '')
        + (lines.length > 1 ? sel('pin-ctx-era', 'Line / period',
              lines.map(function (c) { return { v: c.key, t: c.label + (c.years ? '  (' + c.years + ')' : '') }; }), pick.era, '') : '')
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
      if (mk) mk.onchange = function () { pick.maker = this.value; pick.scale = ''; pick.era = ''; draw(); };
      var sc = card.querySelector('#pin-ctx-scale');
      if (sc) sc.onchange = function () { pick.scale = this.value; pick.era = ''; draw(); };
      var er = card.querySelector('#pin-ctx-era');
      if (er) er.onchange = function () { pick.era = this.value; };

      function chosen() {
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
          _pinOneShot = e2; ov.remove(); _pinRenderBar();
          showToast('Next photo only: ' + _pinEraLabel(e2), 3000);
        };
        card.querySelector('#pin-ctx-keep').onclick = function () {
          var e2 = chosen();
          if (!e2) { showToast('Pick the line first', 2200, true); return; }
          _pinSetHomeEra(e2); _pinOneShot = null; ov.remove(); _pinRenderBar();
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
      num:  ap.rrNum  || '',
      stat: ap.rrStat || '',
      conf: ap.rrConf || '',
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
    var map = { era:'rrEra', grp:'rrGrp', kind:'rrKind', role:'rrRole', type:'rrType', num:'rrNum', stat:'rrStat', conf:'rrConf', ord:'rrOrd' };   // ord: v0.9.1283, drag order · type: v0.9.1297
    var props = { rrV: _PIN_META_V };
    Object.keys(patch).forEach(function (k) {
      if (!map[k]) return;
      var val = patch[k];
      props[map[k]] = (val === null || val === undefined || val === '') ? null : String(val).slice(0, 100);
    });
    try {
      await driveRequest('PATCH', '/files/' + fileId + '?fields=id', { appProperties: props });
      return true;
    } catch (e) {
      console.warn('[inbox] could not save photo details', fileId, e && e.message);
      return false;
    }
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
      _groups.forEach(function (g) {
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
  function _pinSyncReadState(files) {
    var ids = _ids(), seeded = false, toPush = [];
    (files || []).forEach(function (f) {
      if (!f || !f.id) return;
      var meta = f._meta || _pinMetaOf(f);
      var local = ids[f.id];
      var localRead = !!(local && local.rv === READER_VER && (local.num || local.guess));
      var driveNum = meta && meta.num;
      if (driveNum && !localRead) {
        // PULL — Drive knows this read, we don't. Seed a minimal record; keep
        // any local fields we happen to have, but set the number and mark it
        // read at the current reader so the scan skips it and paid excludes it.
        ids[f.id] = Object.assign({}, local || {}, {
          num: driveNum,
          guess: (meta.conf === 'lo') ? 1 : 0,
          rv: READER_VER, tried: 1, free: 1, fromDrive: 1
        });
        seeded = true;
      } else if (localRead && local.num && meta.num !== local.num) {
        // PUSH — we read it, Drive is missing or stale. Stamp the number only
        // (+ how sure), never the status.
        toPush.push({ id: f.id, num: local.num, guess: local.guess });
      }
    });
    if (seeded) _idsSave(ids);
    if (toPush.length) {
      (async function () {
        for (var i = 0; i < toPush.length; i += 4) {
          var slice = toPush.slice(i, i + 4);
          try {
            await Promise.all(slice.map(function (p) {
              return _pinMetaSet(p.id, { num: p.num, conf: p.guess ? 'lo' : 'hi' });
            }));
          } catch (e) { /* best-effort — the next load retries whatever failed */ }
        }
      })();
    }
    return seeded;
  }

  window._pinRefresh = async function () {
    if (!_ensurePage()) return;
    _status('Loading inbox…');
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
          res = await driveRequest('GET', '/files?q=' + q +
            '&fields=nextPageToken,files(id,name,createdTime,appProperties,thumbnailLink)&orderBy=createdTime desc&pageSize=200' +
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
      // Group by the g<id> tag; untagged files are their own group.
      var map = {}, order = [];
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
      _thumbLink = {};
      files.forEach(function (f) {
        if (f.thumbnailLink) _thumbLink[f.id] = f.thumbnailLink;
        // v0.9.1047: metadata first, filename as the fallback — so photos from
        // before today group exactly as they always did.
        f._meta = _pinMetaOf(f);
        var key = f._meta.grp ? 'g' + f._meta.grp : 'f' + f.id;
        if (!map[key]) { map[key] = { key: key, files: [], kind: f._meta.kind, era: f._meta.era }; order.push(key); }
        map[key].files.push(f);
      });
      _groups = order.map(function (k) { return map[k]; });
      // v0.9.1283: a dragged order outranks the listing order, per group.
      _groups.forEach(function (g) { g.files = _pinSortByOrd(g.files); });
      try { _pinReconcileStored(); } catch (eRS) {}
      // v0.9.1412 — reconcile read-state with Drive so the phone and the
      // desktop agree (and the phone never pays to re-read what the desktop
      // already read). PULL is synchronous so the counts below are right;
      // PUSH runs in the background.
      try { _pinSyncReadState(files); } catch (eSY) { console.warn('[inbox] read-state sync failed', eSY && eSY.message); }
      // Drop selections that no longer exist
      Object.keys(_sel).forEach(function (k) { if (!map[k]) delete _sel[k]; });
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
      _status('Could not load the inbox — check your connection and try Refresh.');
    }
  };

  function _render() {
    var grid = document.getElementById('pin-grid'), empty = document.getElementById('pin-empty');
    if (!grid) return;
    // v0.9.1051: draw what passes the filters, but keep counting the whole inbox.
    var _vis = _pinVisibleGroups();
    var total = 0;
    _groups.forEach(function (g) { total += g.files.length; });
    grid.innerHTML = _vis.map(function (g) {
      var isSel = !!_sel[g.key];
      // v0.9.1050: a stack says WHAT it is, not just how many photos.
      var _gk = (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || 'single';
      // v0.9.1176: an untagged stack whose photos read different numbers is not
      // "1 item" either, whatever the kind field says.
      var _gkTxt = (_gk && _gk !== 'single') ? _pinKindLabel(_gk)
        : (g.files.length + ' photos · ' + (_pinIsMultiPiece(g) ? 'several items' : '1 item'));
      var chip = g.files.length > 1 ? '<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.66);color:#fff;font-size:0.62rem;font-weight:700;padding:1px 7px;border-radius:9px">' + rrEsc(_gkTxt) + (_gk !== 'single' ? ' · ' + g.files.length : '') + '</div>' : '';
      var when = '';
      try { when = new Date(g.files[0].createdTime).toLocaleDateString(); } catch (e) {}
      // v0.9.886: AI suggestion (from Identify all) shows on the tile bar
      var sug = _ids()[_pinReadFid(g)];
      var _altN = '';   // v0.9.902 (Brad): candidates but no confident number = still a lead, not "no read"
      if (sug && !sug.num && Array.isArray(sug.alts) && sug.alts.length) {
        var _a0 = String(sug.alts[0]); var _mm = _a0.match(/[0-9][0-9A-Za-z.\-\/]*/); _altN = _mm ? _mm[0] : _a0.slice(0, 12);
      }
      // v0.9.1176 (Brad): on a stack of several pieces the caption used to show
      // the FIRST readable photo's number, which reads as "this stack is a
      // 2328" — one member wearing the whole set's name. Say what the stack is
      // instead: the set it looks like, or how far the reading has got.
      if (_pinIsMultiPiece(g)) {
        when = '<span style="color:var(--info);font-weight:700">' + rrEsc(_pinGroupCaption(g)) + '</span> · ' + when;
      }
      else if (sug && sug.num && sug.guess) when = '<span style="color:#ffb454;font-weight:700">' + String(sug.num).replace(/</g, '&lt;') + ' · best guess</span> · ' + when;   // v0.9.898: hedged read, kept but marked
      else if (sug && sug.num) when = '<span style="color:#7ec3ef;font-weight:700">' + String(sug.num).replace(/</g, '&lt;') + '?</span> · ' + when;
      else if (_altN) when = '<span style="color:#ffb454;font-weight:700">' + _altN.replace(/</g, '&lt;') + ' · best guess</span> · ' + when;   // v0.9.902
      else if (sug && sug.tried) when = '<span style="color:#999">could not read</span> · ' + when;
      // v0.9.888 (Brad): click the photo = open the review (add / research /
      // discard); the corner circle is the multi-select toggle.
      // Default: clicking a tile opens Review. In Select-multiple mode, the tile
      // toggles selection (circles + crop appear/hide accordingly).
      var _tileClick = _selectMode ? '_pinToggle' : '_pinReview';
      var _circle = _selectMode
        ? '<div onclick="event.stopPropagation();_pinToggle(\'' + g.key + '\')" title="Select" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;border:2px solid ' + (isSel ? '#2980b9' : 'rgba(255,255,255,0.75)') + ';background:' + (isSel ? '#2980b9' : 'rgba(0,0,0,0.35)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700">' + (isSel ? '✓' : '') + '</div>'
        : '';
      // v0.9.1058 (Brad: "somehow we need to update the picture to show what it
      // is"). A tag you cannot see is a tag you cannot trust — after tagging 80
      // photos there was no way to tell whether it had worked.
      // v0.9.1060: the era badge sat at top-right, exactly where the group chip
      // ("Set · 7") already lives — they would have stacked on top of each other
      // the moment a grouped photo was also tagged. It goes in the bottom strip
      // instead, which already carries the number and the date and has room.
      var _m0 = (g.files[0] && g.files[0]._meta) || {};
      if (_m0.era) {
        when = '<span style="color:#7ec3ef;font-weight:700">' + rrEsc(_pinEraLabel(_m0.era)) + '</span> · ' + when;
      }
      var _crop = _selectMode ? ''
        : '<div onclick="event.stopPropagation();_pinTileCrop(\'' + g.key + '\')" title="Crop / Rotate" style="position:absolute;right:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8rem;cursor:pointer">✂</div>';
      // v0.9.1057: grouping had no undo. Photos could be put together and never
      // taken apart, so one wrong tick was permanent. Only on stacks, only out
      // of select mode.
      var _ungroup = (_selectMode || g.files.length < 2) ? ''
        : '<div onclick="event.stopPropagation();_pinConfirmUngroup(\'' + g.key + '\')" title="Split this group apart" style="position:absolute;left:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.9rem;cursor:pointer">⊟</div>';
      return '<div class="pin-tile" data-key="' + g.key + '" onclick="' + _tileClick + '(\'' + g.key + '\')" style="position:relative;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--surface2,#26262e);aspect-ratio:1;border:3px solid ' + (isSel ? '#2980b9' : 'transparent') + '">' +
        '<img loading="lazy" data-fid="' + _pinCoverFid(g) + '" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block" alt="">' +
        chip +
        _circle +
        _crop +
        _ungroup +
        '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);color:#ddd;font-size:0.6rem;padding:0.1rem 0.35rem">' + when + '</div>' +
        '</div>';
    }).join('');
    empty.style.display = _groups.length ? 'none' : 'block';
    if (_groups.length && !_vis.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:1.5rem 0;text-align:center;color:var(--text-dim);font-size:0.88rem">'
        + 'No photos match that filter. <button onclick="_pinClearFilters()" style="background:none;border:none;color:var(--accent);text-decoration:underline;cursor:pointer;font-size:0.88rem">Show all</button></div>';
    }
    try { _pinRenderFilters(); } catch (eF) {}
    var cnt = document.getElementById('pin-count');
    // v0.9.1051 (Brad counted 93, the label said 99): the grid draws one tile per
    // GROUP and the count summed FILES. Both were true and neither matched what
    // he could count, so say both.
    if (cnt) {
      var _items = _groups.length;
      var _shown = _vis.length;
      cnt.textContent = !total ? ''
        : (_pinFilterActive()
            ? (_shown + ' of ' + _items + ' item' + (_items > 1 ? 's' : '') + ' shown')
            : (_items === total
                ? (total + ' photo' + (total > 1 ? 's' : '') + ' waiting')
                : (_items + ' item' + (_items > 1 ? 's' : '') + ' \u00b7 ' + total + ' photos waiting')));
    }
    grid.querySelectorAll('img[data-fid]').forEach(function (img) {
      // v0.9.1326: hand over the link the listing already gave us. A missing
      // entry passes null and degrades to the old per-file fetch, so a photo
      // Drive declined to thumbnail still behaves exactly as before.
      var _fid = img.getAttribute('data-fid');
      loadDriveThumb(_fid, img, img.parentElement, _thumbLink[_fid] || null, 'hi');
    });
    _selInfo();
    try { _pinRenderBar(); } catch (eB) {}   // v0.9.1048; v0.9.1057 the bar decides its own visibility
    _navBadge(total);
    _updateIdAllBtn();
    try { _updateIdentifyBtn(); } catch (eRC) {}
    // v0.9.961 (Brad): keep the "cropped" marker set trimmed to files still in
    // the inbox (filed/discarded photos drop out), then republish to drive.js.
    try {
      if (_groups.length) {   // only prune once photos have actually loaded
        var live = {}; _groups.forEach(function (g) { g.files.forEach(function (f) { live[f.id] = 1; }); });
        var c = _cropped(), pruned = {}, changed = false;
        Object.keys(c).forEach(function (fid) { if (live[fid]) pruned[fid] = 1; else changed = true; });
        if (changed) _croppedSave(pruned); else window._rrForceFreshBytes = c;
      } else {
        window._rrForceFreshBytes = _cropped();
      }
    } catch (ePr) {}
  }

  // v0.9.956 (Brad): the gold "Read with a token" button only appears when there
  // are leftover photos the free reader couldn't place — and it says exactly
  // how many, so a paid batch never runs by surprise. Free auto-read handles
  // the easy ones for nothing; this button is the deliberate "spend a credit
  // on the ones that are left" step.
  function _updateIdAllBtn() {
    var b = document.getElementById('pin-idall-btn');
    if (!b) return;
    var ids = _ids();
    var n = _groups.filter(function (g) { return !ids[_pinReadFid(g)]; }).length;
    if (n > 0 && !_selectMode) {
      // v0.9.1075 (Brad: "i am running the free re reader and my tokens are
      // going down every time on the other button"). They are not — nothing on
      // the free path touches a token, and there is a test that fails if that
      // ever changes. This number is how many photos are STILL UNREAD, and it
      // falls because the free reader is succeeding on them. "Read 44 (44
      // tokens)" reads like a balance, so watching it drop after a free run
      // looks exactly like being charged for it. Say which number it is.
      b.textContent = '🔍 Read the ' + n + ' still unread \u00b7 costs ' + n + ' photo ID' + (n === 1 ? '' : 's');
      b.title = n + ' photo' + (n === 1 ? '' : 's') + ' the free reader could not place. This is what it would COST, not what you have left.';
      b.style.display = '';
    } else {
      b.style.display = 'none';
    }
    // v0.9.1411 — on a phone the paid read lives inside "⋯ More"; show that
    // button only when there is actually something paid to reach, so the menu
    // is never opened onto nothing. CSS decides whether More is visible at all
    // (phone only); this just keeps its would-be state honest.
    var mb = document.getElementById('pin-more-btn');
    if (mb) mb.dataset.pinHas = (n > 0 && !_selectMode) ? '1' : '';
  }

  // v0.9.956 (Brad): a plain in-app confirm so a paid batch always asks first.
  // Returns a promise that resolves true (go) or false (cancel). No browser
  // confirm() dialog — that would freeze the extension bridge.
  function _pinConfirm(msg, okLabel) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:1.2rem';
      ov.innerHTML =
        '<div class="rr-card">' +
          '<div style="font-size:0.92rem;color:var(--text-mid);line-height:1.55;margin-bottom:1.1rem">' + msg + '</div>' +
          '<div style="display:flex;gap:0.6rem;justify-content:flex-end">' +
            '<button id="_pcc" style="padding:0.5rem 1rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--text-mid);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Not now</button>' +
            '<button id="_pco" style="padding:0.5rem 1.1rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer">' + (okLabel || 'Continue') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      function done(v) { try { ov.remove(); } catch (e) {} resolve(v); }
      ov.querySelector('#_pcc').onclick = function () { done(false); };
      ov.querySelector('#_pco').onclick = function () { done(true); };
      ov.onclick = function (e) { if (e.target === ov) done(false); };
    });
  }

  // v0.9.900 (Brad): crop straight from the grid tile — one-photo items open
  // the cropper directly; multi-photo stacks open the review card, where every
  // photo has its own ✂.
  window._pinTileCrop = function (key) {
    var g = _groups.filter(function (x) { return x.key === key; })[0];
    if (!g || !g.files.length) return;
    if (g.files.length === 1) return window._pinCropPhoto(g.files[0].id);
    window._pinReview(key);
    showToast('Several photos in this item — use the ✂ on the one you want to crop', 3000);
  };

  window._pinToggle = function (key) {
    if (_sel[key]) delete _sel[key]; else _sel[key] = true;
    _render();
  };

  // Select all / Deselect all (only meaningful in select mode).
  // v0.9.1057: acts on what is VISIBLE, not on everything. That is what makes
  // the filter chips do the heavy lifting — narrow to "Not touched yet", Select
  // all, Apply, and 43 photos are tagged in four taps. Selecting hidden photos
  // would have been an invisible edit, which is the worst kind.
  window._pinSelectAll = function () {
    var vis = _pinVisibleGroups();
    var allSel = vis.length && vis.every(function (g) { return _sel[g.key]; });
    _sel = {};
    if (!allSel) vis.forEach(function (g) { _sel[g.key] = true; });
    _render();
  };

  // Both named buttons run the SAME selection mechanic — circles on the tiles,
  // Select all, a running count, Finished — and differ only in what Apply does.
  // One thing to learn, two jobs.
  window._pinStartMode = function (purpose) {
    if (_selPurpose === purpose) return window._pinFinishMode();
    // switching between the two modes is not "leaving", so no warning here
    _selPurpose = purpose;
    _selectMode = true;
    _sel = {};
    if (purpose === 'tag' && !_tagEra) _tagEra = _sessionEra || '';
    _render();
    // v0.9.1297: group mode opens the floating panel immediately (empty, so
    // its blurb explains the flow); any other mode closes it.
    try { if (purpose === 'group') _pinGrpPanelRender(); else _pinGrpPanelClose(); } catch (eGP) {}
  };

  function _pinCloseMode() {
    _selPurpose = '';
    _selectMode = false;
    _sel = {};
    try { _pinGrpPanelClose(); } catch (eGP) {}
    _render();
  }

  // v0.9.1060 (Brad: "the finished button needs to throw up a warning if nothing
  // has changed as in i didn't hit apply"). Apply CLEARS the ticks, so ticks
  // still sitting there when you press Finished means exactly one thing: that
  // selection was never applied to anything. No extra state to get out of step
  // — the ticks are the evidence.
  window._pinFinishMode = async function () {
    var n = 0;
    _selGroups().forEach(function (g) { n += g.files.length; });
    if (n > 0) {
      var what = _selPurpose === 'tag'
        ? 'tagged with a manufacturer, era and scale'
        : 'put into a group';
      var ok = await _pinConfirm(
        '<b>' + n + ' photo' + (n > 1 ? 's are' : ' is') + ' still selected and '
        + (n > 1 ? 'have' : 'has') + ' not been ' + what + '.</b><br><br>'
        + 'Pressing Apply is what saves the change \u2014 Finished only closes this mode. '
        + 'Leave now and the selection is dropped.',
        'Leave without saving');
      if (!ok) return;                 // stay put, ticks intact
    }
    _pinCloseMode();
  };

  // Kept so nothing that still calls the old name breaks.
  window._pinToggleSelectMode = function () {
    if (_selectMode) return window._pinFinishMode();
    return window._pinStartMode('group');
  };
  window._pinCloseModeNow = _pinCloseMode;   // used by tests and by Apply

  // ── Tag mode: one era onto every ticked photo ───────────────────────────
  function _pinRenderTagBar() {
    var el = document.getElementById('pin-tagbar');
    if (!el) return;
    if (_selPurpose !== 'tag') {
      el.style.display = 'none';
      var ap0 = document.getElementById('pin-apply-btn');
      if (ap0) ap0.style.display = 'none';
      return;
    }
    var n = 0, changing = 0;
    _selGroups().forEach(function (g) {
      g.files.forEach(function (f) {
        n++;
        var m = _pinMetaOf(f);
        if (m && m.era && m.era !== _tagEra) changing++;
      });
    });
    el.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.7rem;'
      + 'padding:0.55rem 0.75rem;border-radius:10px;border:2px solid rgba(41,128,185,0.55);'
      + 'background:rgba(41,128,185,0.08)';
    var ready = !!_tagEra && n > 0;
    // v0.9.1060 (Brad: "the apply button needs to be to the left of the finished
    // button. its lost where its at."). Apply lives in the toolbar beside
    // Finished now — the two decisions that end this mode sit together.
    var apb = document.getElementById('pin-apply-btn');
    if (apb) {
      apb.style.display = '';
      apb.disabled = !ready;
      apb.textContent = 'Apply' + (n ? ' to ' + n : '');
      if (ready) apb.style.background = 'var(--accent)';
      else _pinOpaqueTint(apb, '139,142,148', 25);   // v0.9.1282
      apb.style.color = ready ? '#fff' : 'var(--text-dim)';
      apb.style.cursor = ready ? 'pointer' : 'default';
    }
    el.innerHTML =
      '<span style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);font-weight:700">Tag as</span>'
      + '<button onclick="_pinPickTagEra()" style="flex:1;min-width:150px;text-align:left;padding:0.45rem 0.7rem;border-radius:8px;'
        + 'border:1.5px solid ' + (_tagEra ? '#2980b9' : 'var(--border)') + ';background:' + (_tagEra ? '#f7f0dc' : 'var(--bg)') + ';'
        + 'color:' + (_tagEra ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-head);font-weight:700;font-size:0.9rem;cursor:pointer">'
        + rrEsc(_pinEraLabel(_tagEra)) + ' \u25be</button>'
      // v0.9.1297 (Brad: "on the tag, lets add type to it as well. so i can
      // put paper, or boxcar or whatever"). '' = leave each photo's type
      // as-is, so tagging an era never silently blanks a type set earlier.
      + '<select id="pin-tag-type" style="min-width:130px;padding:0.45rem 0.55rem;border-radius:8px;'
        + 'border:1.5px solid ' + (_tagType ? '#2980b9' : 'var(--border)') + ';background:var(--bg);'
        + 'color:' + (_tagType ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">'
        + '<option value="">Type: (leave as-is)</option>'
        + _PIN_TYPES.map(function (t) { return '<option value="' + t + '"' + (t === _tagType ? ' selected' : '') + '>' + t + '</option>'; }).join('')
      + '</select>'
      + (changing
          ? '<span style="font-size:0.74rem;color:#ffb454;font-weight:600;width:100%">'
            + changing + ' of those already ' + (changing === 1 ? 'has' : 'have') + ' a different era and will be changed</span>'
          : '');
    var _tt = document.getElementById('pin-tag-type');
    if (_tt) _tt.onchange = function () { _tagType = this.value; };
  }

  window._pinPickTagEra = function () {
    window._pinPickContext({
      title: 'Tag these photos as\u2026',
      blurb: 'This gets saved with each ticked photo, so the app knows which catalog to look in.',
      okLabel: 'Use this',
      onPick: function (era) { _tagEra = era; _pinRenderTagBar(); },
    });
  };

  // Applies to every FILE in every ticked group — an engine and its tender are
  // one item and must not end up with different makers.
  window._pinApplyTags = async function () {
    // v0.9.1418 (Cooper): THE reported bug. This was a bare `return` — the
    // Apply button's only silent exit, and the one he hit eight times.
    if (_busy) { _pinBusyBounce(); return; }
    if (!_tagEra) { showToast('Pick a manufacturer and line first', 2600, true); return; }
    var ids = [];
    _selGroups().forEach(function (g) { g.files.forEach(function (f) { ids.push(f.id); }); });
    if (!ids.length) { showToast('Tick some photos first', 2400, true); return; }
    _setBusy(true, 'Tagging photos');
    var label = _pinEraLabel(_tagEra) + (_tagType ? ' \u00b7 ' + _tagType : '');
    _status('Tagging ' + ids.length + ' photo' + (ids.length > 1 ? 's' : '') + '\u2026');
    var ok = 0;
    try {
      // v0.9.1297: the Type rides with the era when one is picked; '' means
      // "leave as-is" and is deliberately NOT sent, so it can never blank a
      // type that an earlier tagging pass set.
      var _patch = { era: _tagEra, stat: 'stamped' };
      if (_tagType) _patch.type = _tagType;
      ok = await _pinMetaSetMany(ids, _patch, function (done) {
        _status('Tagging ' + done + ' of ' + ids.length + '\u2026');
      });
    } catch (e) {
      console.warn('[inbox] tagging failed', e && e.message);
    } finally {
      // v0.9.1325: was a bare `_busy = false` here. Two statements run BEFORE
      // the try (the label build and the _status call), so a throw in either
      // left _busy stuck and every batch button in the inbox answered "still
      // working on the last batch…" until a reload. This was the last of the
      // seven _busy writers in this file without a finally.
      _setBusy(false);
      _status('');
    }
    // Say what actually happened. A partial write reported as a win is the bug
    // this app has been burned by before.
    if (ok === ids.length) showToast('Tagged ' + ok + ' photo' + (ok > 1 ? 's' : '') + ' as ' + label, 3200);
    else showToast('Tagged ' + ok + ' of ' + ids.length + ' \u2014 the rest did not save, try again', 4200, true);
    _sel = {};                 // clear the ticks, STAY in tag mode for the next batch
    await window._pinRefresh();
  };

  // ══ v0.9.1282 (Brad: "you can see the logo through group photos and tag
  // photo") — THE THIRD PAINTER. v0.9.1273 fixed the markup, v0.9.1274 fixed
  // the stylesheet, and these buttons were still see-through because
  // JavaScript repaints them on every selection change — and the FIRST time
  // JS touches an element's style, the browser re-serialises the style
  // attribute, "#2980b9" becomes "rgb(41, 128, 185)", and the v0.9.869
  // lever's [style*="#2980b9"] selector silently stops matching. The lever's
  // opaque background walks away at the exact moment a translucent JS wash
  // is painted on. Every JS tint goes through this helper now: fallback
  // first, then the mix — a browser without color-mix keeps the opaque
  // fallback, exactly like the two-declaration markup pattern.
  function _pinOpaqueTint(el, rgbCsv, pct) {
    el.style.background = 'var(--bg-card)';
    el.style.background = 'color-mix(in srgb, rgb(' + rgbCsv + ') ' + pct + '%, var(--bg-card))';
  }

  function _selGroups() { return _groups.filter(function (g) { return _sel[g.key]; }); }

  function _selInfo() {
    var gs = _selGroups(), n = 0;
    gs.forEach(function (g) { n += g.files.length; });
    var info = document.getElementById('pin-selinfo');
    var ab = document.getElementById('pin-assign-btn'), db = document.getElementById('pin-discard-btn');
    var ib = document.getElementById('pin-idsel-btn');   // v0.9.897 (Brad): identify just the ticked photos
    if (info) info.textContent = n ? (n + ' photo' + (n > 1 ? 's' : '') + ' selected') : (_selectMode ? 'Tap photos to select' : '');
    var sa = document.getElementById('pin-selall-btn');
    if (sa) {
      sa.style.display = _selectMode ? '' : 'none';
      var vis = _pinVisibleGroups();
      var allSel = vis.length && vis.every(function (g) { return _sel[g.key]; });
      sa.textContent = allSel ? 'Deselect all' : 'Select all';
    }
    // v0.9.1057: which actions show depends on WHY you are selecting.
    var isGroup = _selPurpose === 'group', isTag = _selPurpose === 'tag';
    if (ab) ab.style.display = (isGroup && gs.length > 1) ? '' : 'none';   // combine needs 2+ items
    // v0.9.1297: the "Group as…" toolbar button is gone — the floating panel
    // IS the grouping surface, and every tick repaints it.
    if (isGroup) { try { _pinGrpPanelRender(); } catch (eGP) {} }
    // Discard and Read stay available in both modes — you are already looking
    // at photos with ticks on them, and binning the junk is the same gesture.
    //
    // v0.9.1325: gated on _selectMode as well as the count. These two are the
    // only buttons here that SPEND or DESTROY, and they used to arm on the
    // count alone — so any stray entry left in `_sel` outside select mode
    // offered them against photos with no tick drawn anywhere. The root leak
    // is fixed (see _pinReviewDiscard), and this makes the class impossible:
    // no ticks visible, no destructive button.
    if (db) db.style.display = (_selectMode && n) ? '' : 'none';
    if (ib) {
      ib.style.display = (_selectMode && n) ? '' : 'none';
      // v0.9.1351: say the COST on the button, not only in the confirm dialog.
      // This is the same purchase as "Read this photo (1 photo ID)" on the card
      // and the toolbar's "Read the N still unread" — one word, "Read", for all
      // three, and the price visible before the click rather than after it.
      ib.textContent = (n === 1) ? 'Read this · 1 photo ID'
                                 : 'Read these ' + n + ' · ' + n + ' photo IDs';
    }
    var fb = document.getElementById('pin-finish-btn');
    if (fb) fb.style.display = _selectMode ? '' : 'none';
    [['pin-group-btn', isGroup], ['pin-tag-btn', isTag]].forEach(function (p) {
      var b = document.getElementById(p[0]);
      if (!b) return;
      _pinOpaqueTint(b, p[1] ? '41,128,185' : '139,142,148', p[1] ? 18 : 12);   // v0.9.1282: opaque, see _pinOpaqueTint
      b.style.borderColor = p[1] ? '#2980b9' : '#8b8e94';
      b.style.display = (_selectMode && !p[1]) ? 'none' : '';
    });
    try { _pinRenderTagBar(); } catch (eT) {}
  }

  // ── Import ───────────────────────────────────────────────────
  window._pinPickFiles = function () {
    var inp = document.getElementById('pin-file-input');
    if (inp) inp.click();
  };

  // ── Batch Add Photos: one door in, device-aware source picker ──
  // Desktop → From Your Drive (computer files) / From Google Photos.
  // Mobile  → Take with Phone (camera) / From Google Photos.
  // v0.9.1057: Add photos now STARTS a shooting session — set maker/scale/line
  // once, then every photo in the session inherits it. Skip is a first-class
  // option: an unstamped photo is exactly as useful as every photo taken before
  // today, so this must never be a wall.
  window._pinAddSource = function () {
    if (!_pinSession) {
      return window._pinPickContext({
        title: 'What are you about to photograph?',
        blurb: 'Set it once and every photo in this session is stamped with it. You can switch mid-session, and Done ends it.',
        okLabel: 'Start shooting',
        cancelLabel: 'Skip \u2014 just add photos',
        onPick: function (era) {
          _pinSession = true;
          _pinSetHomeEra(era);
          _pinOneShot = null;
          _pinRenderBar();
          showToast('Now shooting ' + _pinEraLabel(era), 2600);
          _pinAddSourceSheet();
        },
        onCancel: function () { _pinAddSourceSheet(); },
      });
    }
    return _pinAddSourceSheet();
  };

  function _pinAddSourceSheet() {
    var mobile = !!window.IS_MOBILE_UA;
    var ex = document.getElementById('pin-src-ov'); if (ex) ex.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-src-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    var bcss = 'display:flex;align-items:center;gap:0.7rem;width:100%;padding:0.95rem 1rem;border-radius:10px;border:2px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer;text-align:left';
    var X = "document.getElementById('pin-src-ov').remove();";
    // ── v0.9.1417 (beta tester 1, iPhone: "not able to add things from his
    // camera roll") ──────────────────────────────────────────────────────
    // He was right, and it was not a bug — the door was never built. This
    // sheet gave a phone two choices, "Take with Phone" and "From Google
    // Photos", and put the file picker on desktop only. So the one thing a
    // collector most wants to do on a phone — add the photos already sitting
    // in it — had no button at all.
    //
    // The assumption behind that was backwards. `<input type="file"
    // accept="image/*">` is BETTER on a phone than on a desktop: iOS offers
    // Photo Library / Take Photo / Choose File, and Choose File is where
    // Google Photos, iCloud and Files all appear as providers. It is the same
    // _pinPickFiles() that has been working on desktop all along, and its
    // click() runs synchronously inside this button's onclick, so iOS keeps
    // the user gesture and the picker opens.
    var srcBtn = function (icon, label, call, note) {
      return '<button style="' + bcss + '" onclick="' + X + call + '">' +
        '<span style="font-size:1.3rem">' + icon + '</span> ' + label +
        (note ? '<span style="color:var(--text-dim);font-size:0.78rem;font-weight:400"> — ' + note + '</span>' : '') +
        '</button>';
    };
    var sources = mobile
      ? srcBtn('📷', 'Take with Phone', '_qcOpen()')
        + srcBtn('🖼️', 'From My Photos', '_pinPickFiles()', 'camera roll')
        + srcBtn('☁️', 'From Google Photos', '_pinGPhotos()')
      : srcBtn('💻', 'From This Computer', '_pinPickFiles()', 'your own files')
        + srcBtn('☁️', 'From Google Photos', '_pinGPhotos()');
    ov.innerHTML = '<div class="rr-card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text)">Add photos from…</div>' +
        '<button onclick="' + X + '" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;line-height:1;cursor:pointer;padding:0.1rem 0.3rem">✕</button>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:0.6rem">' + sources + '</div>' +
    '</div>';
    document.body.appendChild(ov);
  };

  // Entry from the +Add menu ("Batch Add Photos"): land on the inbox page so
  // the import handlers have their DOM, then offer the source picker.
  window._pinBatchStart = function () {
    window._pinGo(document.getElementById('nav-photo-inbox'));
    setTimeout(function () { window._pinAddSource(); }, 60);
  };

  async function _upload(files) {
    if (_busy) { _pinBusyBounce(); return; }
    _setBusy(true, 'Adding photos');
    try {
      var fid = await _folder();
      var ts = new Date().getTime();
      // v0.9.1048: whatever the bar is showing goes onto the photo. A one-shot
      // is spent by the FIRST photo of the batch and then springs back, so a
      // single odd item in a long run cannot leak into the next forty.
      var _era = _pinActiveEra();
      var _spentOneShot = false;
      // v0.9.1275 (R15): one failed upload used to abandon every file after
      // it, and the catch below turned 7-of-10 into a message that reads as
      // 0-of-10. Each file gets its own try now; the toast tells the truth.
      var _upOk = 0, _upFail = 0;
      for (var i = 0; i < files.length; i++) {
        _status('Uploading ' + (i + 1) + ' of ' + files.length + '…');
        var f = files[i];
        var safe = (f.name || 'photo.jpg').replace(/[^\w.\- ]+/g, '').slice(-60);
        // Desktop drops: one group per file (phone capture will reuse the
        // same tag to group several shots of one item).
        var name = 'INBOX ' + ts + ' g' + (ts + i) + ' ' + safe;
        var up;
        try {
          up = await driveUploadFile(f, name, fid);
          _upOk++;
        } catch (eUp) {
          _upFail++;
          console.warn('[Inbox] upload failed for ' + safe + ' — continuing:', eUp);
          continue;
        }
        var _thisEra = (_pinOneShot && !_spentOneShot) ? _pinOneShot : _pinHomeEra();
        if (i === 0 && _pinOneShot) _spentOneShot = true;
        if (_thisEra && up && up.id) {
          // A stamp that fails to save must not fail the upload — the photo is
          // safely in the inbox either way, it just knows less.
          await _pinMetaSet(up.id, { era: _thisEra, stat: 'stamped' });
        }
      }
      if (_pinOneShot) { _pinOneShot = null; _pinRenderBar(); }
      _status('');
      if (_upFail) {
        showToast('Added ' + _upOk + ' of ' + files.length + ' photo' + (files.length > 1 ? 's' : '')
          + ' \u2014 ' + _upFail + ' failed to upload. Check your connection and add those again.', 5200, true);
      } else {
        // v0.9.1097: a photo with no era tag reads against EVERY catalog at
        // once and matches strangers (Brad's 3545 came back as an Atlas item).
        // Say it at upload time, when fixing it is one Tag away.
        // v0.9.1325: this used to read _pinOneShot, which is cleared ~9 lines
        // ABOVE, so the test always collapsed to !_pinHomeEra(). Result: arm a
        // one-shot era with no home era, upload, and the photos WERE stamped
        // correctly but the toast said "no maker/era tag yet… use the Tag
        // button to stamp them" — sending the user to redo work already done.
        // _era is the snapshot taken before the clear (it was assigned and
        // never used — the leftover of exactly this).
        var _noEraUp = !_era;
        if (_noEraUp) showToast('Added ' + files.length + ' photo' + (files.length > 1 ? 's' : '')
          + ' \u2014 no maker/era tag yet, so reads will be unfiltered. Use the Tag button to stamp them.', 5200);
        else showToast('Added ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + ' to the inbox', 2500);
      }
      _pinRefresh();
    } catch (e) {
      console.error('[Inbox] upload:', e);
      _status('Upload failed — check your connection and try again.');
    } finally { _setBusy(false); }
  }

  // ── Review a photo group: research laid out → Add / Research /
  //    Discard (v0.9.888, Brad's flow). Also handles "Combine → one
  //    item…" for a multi-selection (all selected photos = one item).
  var _rvGroups = [];

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

  function _pinBestMaster(num, aiMfr, prefer) {
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
  // The era stamped on the photo currently open in the review card.
  function _rvPrefer() {
    try { return (_rvGroups && _rvGroups.length) ? _pinPreferOf(_rvGroups[0]) : null; }
    catch (e) { return null; }
  }

  function _pinLookup(num, aiMfr, prefer) {
    num = String(num || '').trim();
    var out = { num: num, master: null, ownedPd: null, maker: '', era: '', desc: '', mfrMismatch: '' };
    if (!num) return out;
    // Default to the era stamped on the photo being reviewed, so every caller
    // gets it without having to remember to pass it.
    if (prefer === undefined) prefer = _rvPrefer();
    out.master = _pinBestMaster(num, aiMfr, prefer);
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
    return '<div id="pin-rv-excl" style="margin-top:0.55rem;padding:0.5rem 0.65rem;border:1px solid var(--border);border-radius:9px;background:var(--surface2)">'
      + '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.3rem">Numbers excluded from earlier scans</div>'
      + _exclView.nums.map(function (n, i) {
          var on = stored.indexOf(n) >= 0;
          return '<label style="display:inline-flex;align-items:center;gap:0.35rem;margin:0 0.75rem 0.3rem 0;font-size:0.82rem;color:var(--text);cursor:pointer">'
            + '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="_pinRejectToggle(' + i + ', this.checked)" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer">'
            + rrEsc(n) + '</label>';
        }).join('')
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">Checked numbers are left out of the scan. Un-check one to allow it again — if the answer is still wrong, hit the re-scan button below.</div>'
      + '</div>';
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

  var _rvAiMfr = '';
  window._pinReviewLookup = function (val) {
    var box = document.getElementById('pin-rv-info');
    var addBtn = document.getElementById('pin-rv-add');
    if (!box) return;
    var lk = _pinLookup(val, _rvAiMfr);
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
      html = '<div style="font-size:0.82rem;color:#d4a843;font-weight:700;line-height:1.5;margin-bottom:0.35rem">⚠ The photo says ' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' — but #' + String(lk.num).replace(/</g, '&lt;') + ' in the catalog is a ' + String(lk.maker || '?').replace(/</g, '&lt;') + ' item. Probably NOT the same thing.</div>'
        + row('Catalog has', (lk.maker || '—') + ': ' + String(lk.desc).replace(/</g, '&lt;'))
        + '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' isn\'t in the master catalog' + ((typeof state !== 'undefined' && state.masterData && state.masterData.some(function (it) { return _pinMfrAgree(lk.mfrMismatch, it.manufacturer || ''); })) ? ' under this number' : ' yet') + ' — Add will create a manual ' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' entry instead of the ' + String(lk.maker || '').replace(/</g, '&lt;') + ' item.</div>';
    } else if (lk.master) {
      html = row('Maker', (lk.maker || '—') + (lk.era ? ' <span style="font-weight:400;color:var(--text-dim)">(' + lk.era + ')</span>' : ''))
        + row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + row('Description', String(lk.desc).replace(/</g, '&lt;'));
    } else {
      html = row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">Not found in the catalog — you can still add it, or Research to double-check the number.</div>';
    }
    if (lk.ownedPd && lk.ownedAgrees === false) {
      // Same number, different item — say so plainly instead of claiming a duplicate.
      html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:#d4a843;font-weight:700;line-height:1.5">You own a '
        + rrEsc(lk.ownedLabel) + ' \u2014 same number, different item. This one is new to your collection.'
        + _pinSeeItLink(lk.ownedPd) + '</div>';
    } else if (lk.ownedPd) {
      html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:#2ecc71;font-weight:700">\u2713 You already own one — this will be added as a separate copy.'
        + _pinSeeItLink(lk.ownedPd) + '</div>';
    }
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
  var _vfNote  = {};   // group key -> rejection note for the re-identify run
  function _pinVerifyRender(lk) {
    var box = document.getElementById('pin-rv-info');
    if (!box || !_rvGroups || !_rvGroups.length || !lk) return;
    var link = (lk.master && (lk.master.refLink || '')) || '';
    if (!lk.num || !/^https?:\/\//i.test(link)) return;
    if (typeof aiVerifyPhoto !== 'function') return;
    var fid0 = _rvGroups[0].files[0].id;
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
      el.innerHTML = '<button onclick="_pinVerifyClick()" style="padding:0.4rem 0.7rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">📷 Double-check vs catalog photo</button>';
    }
  }
  window._pinVerifyClick = function () {
    var num = (document.getElementById('pin-rv-num') || {}).value || '';
    var lk = _pinLookup(num, _rvAiMfr);
    var el = document.getElementById('pin-rv-verify');
    if (!el || !_rvGroups || !_rvGroups.length || !lk.master) return;
    _pinVerifyRun(lk, _rvGroups[0].files[0].id + '|' + lk.num, el);
  };
  async function _pinVerifyRun(lk, key, el) {
    el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim)">📷 Checking your photo against the catalog listing…</div>';
    var vr;
    try {
      var blob = await _pinBytes(_rvGroups[0].files[0].id);
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
      el.innerHTML = '<div style="font-size:0.84rem;color:#2ecc71;font-weight:700">✓ Your photo matches the catalog listing' +
        (vr.refItem ? ' <span style="font-weight:400;color:var(--text-dim)">(' + esc(vr.refItem) + ')</span>' : '') + '</div>';
    } else if (vr.match === 'no') {
      el.innerHTML =
        '<div style="font-size:0.84rem;color:#f05008;font-weight:700;line-height:1.45">✗ Your photo does NOT match the catalog listing' +
        (vr.differences && vr.differences.toLowerCase() !== 'none' ? ' — ' + esc(vr.differences) : '') + '</div>' +
        (vr.refItem ? '<div style="font-size:0.76rem;color:var(--text-dim);margin-top:0.15rem">Catalog photo shows: ' + esc(vr.refItem) + '</div>' : '') +
        '<button onclick="_pinVerifyReident()" style="margin-top:0.4rem;padding:0.45rem 0.7rem;border-radius:8px;border:none;background:#f05008;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">Re-identify with this clue</button>';
      // The app has just said, in red, that this is the wrong item. Leaving Add
      // as the orange default invites the tap that files it anyway.
      _pinDemoteAdd(true);
    } else {
      el.innerHTML = '<div style="font-size:0.78rem;color:#d4a843">? Couldn\'t confirm against the catalog photo' +
        (vr.differences && vr.differences.toLowerCase() !== 'none' ? ' — ' + esc(vr.differences) : '') + '</div>';
    }
  }
  window._pinVerifyReident = async function () {
    // v0.9.1418: this one already spoke, but only ever said "already
    // running" — which is a lie once the job is wedged. Through the shared
    // bounce it can offer the way out instead.
    if (_busy) { _pinBusyBounce(); return; }
    var g = _rvGroups && _rvGroups[0];
    if (!g) return;
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    var vr = _vfCache[g.files[0].id + '|' + num];
    _vfNote[g.key] = 'The number ' + num + ' was proposed, but the catalog reference photo for that number shows a DIFFERENT product' +
      (vr && vr.differences ? ' (' + vr.differences + ')' : '') + '.';
    var ids = _ids();
    delete ids[_pinReadFid(g)];
    _idsSave(ids);
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    await _pinIdentifyRun([g], ids);
    delete _vfNote[g.key];
    window._pinReview(g.key);
  };

  // v0.9.969 (Brad): show the daily token count on the review card. The relay
  // returns "remaining" after each paid read; we cache the last one (per day)
  // and display it so the count stays visible without an extra request.
  function _tokGet() {
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

  // ══ v0.9.1057 — move through the inbox without closing the card ══════════
  // Brad: "need a next item arrow to the right and a previous item arrow to the
  // left of this pop up. that way i can crop an image, hit next and move
  // through the list quickly."
  //
  // Steps through the VISIBLE groups, so it follows whatever filter is on —
  // filter to "Not touched yet" and next/prev walks only those. Stops at both
  // ends rather than wrapping: on a hundred wall photos, silently looping back
  // to the start would have you re-doing work without noticing.
  function _pinRvOrder() {
    // The snapshot keeps a card reachable even after acting on it changed
    // which filters it passes; keys that left the inbox entirely (filed,
    // discarded) are skipped, so the arrows keep walking what remains.
    if (_rvOrderKeys) {
      var by = {};
      _groups.forEach(function (g) { by[g.key] = g; });
      var out = [];
      _rvOrderKeys.forEach(function (k) { if (by[k]) out.push(by[k]); });
      if (out.length) return out;
    }
    return _pinVisibleGroups();
  }

  function _pinRvIndex() {
    if (!_rvKey) return -1;
    var ord = _pinRvOrder();
    for (var i = 0; i < ord.length; i++) if (ord[i].key === _rvKey) return i;
    return -1;
  }

  // ══ v0.9.1172 — INSIDE A GROUP, THE ARROWS WALK THE GROUP ══════════════
  // Brad: "when i am in the detail of an item of a group, the next button should
  // go to the next item in the group. not to the next item in the photo box."
  // He chose stop-at-the-end, greyed — the same rule he picked for the detail-page
  // arrows in v0.9.1155, so you can SEE that you are done with the group instead
  // of being silently moved on to something else.
  //
  // A single-photo group has no members to walk, so there the arrows keep stepping
  // through the inbox exactly as before.
  function _pinRvMembers() {
    try {
      if (!_rvGroups || _rvGroups.length !== 1) return null;   // multi-select card
      var g = _rvGroups[0];
      return (g && g.files && g.files.length > 1) ? g.files : null;
    } catch (e) { return null; }
  }
  function _pinRvMemberIndex() {
    var fl = _pinRvMembers();
    if (!fl) return -1;
    var cur = _pinOnScreenFid();
    for (var i = 0; i < fl.length; i++) if (fl[i].id === cur) return i;
    return 0;
  }
  window._pinReviewStepMember = function (delta) {
    var fl = _pinRvMembers();
    if (!fl) return;
    var i = _pinRvMemberIndex(), j = i + delta;
    if (j < 0 || j >= fl.length) return;        // stop at the ends, never wrap
    window._pinRvSetMain(fl[j].id);
    // The arrows and the counter now describe a different member, so they have to
    // be redrawn — otherwise "2 of 6" freezes and the greying lies at the ends.
    try {
      var hd = document.getElementById('pin-rv-nav');
      if (hd && hd.children.length >= 3) {
        hd.children[0].outerHTML = _pinRvNavHtml('prev');
        hd.children[2].outerHTML = _pinRvPosHtml();
        hd.children[3].outerHTML = _pinRvNavHtml('next');
      }
    } catch (eN) {}
  };

  // ONE button builder for both sequences. The member and inbox arrows differ only
  // in what they call and what they are called — duplicating the style gave the
  // colour ratchet a second literal to carry, and it was right to refuse it.
  function _pinRvArrow(dir, can, call, title) {
    var glyph = dir === 'prev' ? '\u2039' : '\u203a';
    return '<button onclick="' + call + '(' + (dir === 'prev' ? -1 : 1) + ')"'
      + (can ? '' : ' disabled')
      + ' title="' + title + '" aria-label="' + title + '"'
      + ' style="width:40px;height:40px;min-width:40px;border-radius:9px;border:1.5px solid '
      + (can ? 'var(--border)' : 'transparent') + ';background:'
      + (can ? 'var(--surface2)' : 'transparent') + ';color:'
      + (can ? 'var(--text)' : 'rgba(139,142,148,0.35)')
      + ';font-size:1.5rem;line-height:1;cursor:' + (can ? 'pointer' : 'default')
      + ';padding:0;flex-shrink:0">' + glyph + '</button>';
  }
  function _pinRvNavHtml(dir) {
    var fl = _pinRvMembers();
    if (fl) {
      var mi = _pinRvMemberIndex();
      return _pinRvArrow(dir, dir === 'prev' ? mi > 0 : mi < fl.length - 1,
        '_pinReviewStepMember',
        dir === 'prev' ? 'Previous item in this group' : 'Next item in this group');
    }
    var i = _pinRvIndex();
    if (i < 0) return '';                       // multi-select card: no sequence
    var ord = _pinRvOrder();
    return _pinRvArrow(dir, dir === 'prev' ? i > 0 : i < ord.length - 1,
      '_pinReviewStep', dir === 'prev' ? 'Previous photo' : 'Next photo');
  }

  function _pinRvPosHtml() {
    // v0.9.1172: inside a group the count describes the GROUP, or "2 of 6" would
    // be read as position in the inbox and the arrows would look broken.
    var fl = _pinRvMembers();
    if (fl) {
      return '<span style="font-size:0.74rem;color:var(--text-dim);font-family:var(--font-body);white-space:nowrap">'
        + (_pinRvMemberIndex() + 1) + ' of ' + fl.length + ' in this group</span>';
    }
    var i = _pinRvIndex();
    if (i < 0) return '';
    return '<span style="font-size:0.74rem;color:var(--text-dim);font-family:var(--font-body);white-space:nowrap">'
      + (i + 1) + ' of ' + _pinRvOrder().length + '</span>';
  }

  // v0.9.1176: the header used to say "N photos · one item" for every card ever
  // opened, including a seven-photo set. When the stack is several pieces it
  // says so — and when the Sets catalog recognises the numbers, it says which
  // set, which is the answer Brad actually wanted from the card.
  function _pinRvTitle(n) {
    var base = n + ' photo' + (n > 1 ? 's' : '');
    var g = (_rvGroups && _rvGroups.length === 1) ? _rvGroups[0] : null;
    if (!g) return base;                       // multi-select card: no single identity
    if (!_pinIsMultiPiece(g)) return base + ' · one item';
    var nums = _pinGroupNums(g);
    var guess = _pinSetGuess(nums);
    if (guess) return base + ' · ' + rrEsc('set ' + guess.setNum);
    var kind = (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || g.kind || 'single';
    if (kind !== 'single') return base + ' · ' + rrEsc(_pinKindLabel(kind));
    return base + ' · ' + nums.length + ' items';
  }
  if (typeof window !== 'undefined') window._pinRvTitle = _pinRvTitle;

  window._pinReviewStep = function (delta) {
    var i = _pinRvIndex();
    if (i < 0) return;
    var ord = _pinRvOrder();
    var j = i + delta;
    if (j < 0 || j >= ord.length) return;
    window._pinReview(ord[j].key);
  };

  window._pinCloseReview = function () {
    var ov = document.getElementById('pin-review-ov');
    if (ov) ov.remove();
    _rvOrderKeys = null;         // v0.9.1307: next opening snapshots fresh
  };

  // Left/right arrow keys do the same thing on a desktop keyboard. Ignored
  // while a text box has focus, so typing a number is never hijacked.
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('pin-review-ov')) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) return;
    // v0.9.1178: the where-from sheet is a sheet too — arrow keys must not walk
    // the group behind it while it is open.
    if (document.getElementById('pin-ctx-sheet') || document.getElementById('pin-wf-sheet')
        || document.getElementById('pin-help-sheet') || window._rrCropOpen) return;
    e.preventDefault();
    window._pinReviewStep(e.key === 'ArrowLeft' ? -1 : 1);
  });

  // v0.9.1283 — drag a review-card thumb to reorder the group's photos. The
  // order is written to each photo (rrOrd appProperties) so it survives to
  // every device and every later screen; _pinSortByOrd applies it wherever
  // the group is drawn. Desktop gesture; single-group cards only — a
  // multi-select card mixes several items, and "order" has no one meaning
  // there.
  function _pinWireRvDrag(root) {
    if (window.IS_MOBILE_UA) return;
    if (!_rvGroups || _rvGroups.length !== 1) return;
    var wraps = Array.prototype.slice.call(root.querySelectorAll('[data-dragfid]'));
    if (wraps.length < 2) return;
    wraps.forEach(function (w) {
      w.draggable = true;
      w.style.cursor = 'grab';
      w.ondragstart = function (e) {
        e.dataTransfer.setData('text/plain', w.getAttribute('data-dragfid'));
        e.dataTransfer.effectAllowed = 'move';
        w.style.opacity = '0.45';
      };
      w.ondragend = function () { w.style.opacity = ''; };
      w.ondragover = function (e) { e.preventDefault(); w.style.outline = '2px solid var(--accent)'; };
      w.ondragleave = function () { w.style.outline = ''; };
      w.ondrop = function (e) {
        e.preventDefault(); e.stopPropagation(); w.style.outline = '';
        var from = e.dataTransfer.getData('text/plain');
        var to = w.getAttribute('data-dragfid');
        if (!from || from === to) return;
        var ids = _rvGroups[0].files.map(function (f) { return f.id; });
        var fi = ids.indexOf(from), ti = ids.indexOf(to);
        if (fi < 0 || ti < 0) return;
        ids.splice(ti, 0, ids.splice(fi, 1)[0]);
        window._pinSaveRvOrder(ids);
      };
    });
  }

  window._pinSaveRvOrder = async function (orderedFids) {
    var g = _rvGroups && _rvGroups.length === 1 && _rvGroups[0];
    if (!g) return;
    var ok = 0, fail = 0;
    for (var i = 0; i < orderedFids.length; i++) {
      var r = await _pinMetaSet(orderedFids[i], { ord: i + 1 });
      if (r) ok++; else fail++;
    }
    // memory follows what was asked, so the redraw shows the dragged order
    // even while a failed write is being retried by hand.
    g.files.sort(function (a, b) { return orderedFids.indexOf(a.id) - orderedFids.indexOf(b.id); });
    g.files.forEach(function (f, i) { if (f._meta) f._meta.ord = i + 1; });
    if (fail) showToast('Saved the order for ' + ok + ' of ' + orderedFids.length + ' photos — drag again to retry the rest', 4500, true);
    else showToast('✓ Order saved — the first photo is the main view', 2500);
    try { window._pinReview(_rvKey || (g && g.key)); } catch (e) {}
  };

  // v0.9.1325: `only` lets a caller name the groups OUTRIGHT instead of
  // staging them in the shared `_sel` map. Three review-card helpers used to
  // do the latter — see the note on _pinReviewDiscard — which left photos
  // ticked INVISIBLY after the card closed, because the tick circle is only
  // drawn in select mode while the toolbar arms Discard and Identify on the
  // COUNT alone. An explicit argument cannot leak.
  window._pinReview = function (key, only) {
    _rvKey = key || '';          // v0.9.1057: which group the card is showing
    _rvGroups = key ? _groups.filter(function (g) { return g.key === key; })
                    : (only && only.length ? only.slice() : _selGroups());
    if (!_rvGroups.length) { showToast('Select photos first', 2500, true); return; }
    // v0.9.1307: snapshot the walking order ONCE per card-opening — stepping
    // re-enters here with a new key and must keep the same snapshot.
    if (key && !_rvOrderKeys) {
      _rvOrderKeys = _pinVisibleGroups().map(function (g) { return g.key; });
    }
    var n = 0; _rvGroups.forEach(function (g) { n += g.files.length; });
    // v0.9.1068 (Brad's 6817 flatcar). The free reader guessed "58", the catalog
    // double-check said in red that the photo does NOT match a rotary snow plow
    // — and the app still put 58 in the number box, resolved it into a full
    // catalog panel, and left "Add to my Collection" as the orange default. One
    // tap files an item he does not own. Three separate pieces of the screen
    // were lending confidence to a guess the app had already contradicted.
    //
    // A number in an input field does not look like a guess. So only a
    // CONFIRMED read pre-fills it now; a guess is offered as a chip to tap, and
    // nothing is entered, looked up or ready to save until the user says so.
    var sug = '', sugGuess = '';
    _rvAiMfr = '';
    try {
      // v0.9.1096 fixed the chip reading a different slot than the card
      // (6424 vs "080 — use this") by preferring the readable slot. Brad's
      // 3512 fire car showed the fix was HALF right: the card leads with the
      // ON-SCREEN photo's slot, so when the two photos of a group disagree
      // (3512 best-guess on the main shot, a stale confirmed "959" on the
      // tail shot) the headline said 3512 while the input quietly filled in
      // 959 — Barn Set. One record feeds everything now, in the SAME order
      // the card resolves it: the photo on screen first, the readable slot
      // as the fallback.
      var s0 = _ids()[_rvGroups[0].files[0].id]
            || _ids()[_pinReadFid(_rvGroups[0]) || _rvGroups[0].files[0].id];
      if (s0 && s0.num) { if (s0.guess) sugGuess = String(s0.num); else sug = String(s0.num); }
      if (s0 && s0.mfr) _rvAiMfr = String(s0.mfr);
    } catch (eS) {}
    // v0.9.966 (Brad): the read found a description but no structured number
    // (e.g. "No. 260 … illuminated bumper" with an empty number field). Recover
    // the catalog number from that text — master-validated — so the box fills in.
    try {
      if (!sug && !sugGuess && s0) {
        var _recTxt = [s0.mfr, s0.road, s0.desc].filter(Boolean).join(' ');
        var _recNum = _numberFromText(_recTxt);
        if (_recNum && _recNum.num) sugGuess = String(_recNum.num);
      }
    } catch (eR) {}
    var nums = {};
    Object.values((window.state || {}).personalData || {}).forEach(function (pd) {
      if (pd && pd.owned && pd.itemNum) nums[pd.itemNum] = true;
    });
    var opts = Object.keys(nums).sort().slice(0, 900).map(function (o) { return '<option value="' + String(o).replace(/"/g, '&quot;') + '">'; }).join('');
    var old = document.getElementById('pin-review-ov'); if (old) old.remove();
    var thumbs = [];
    _rvGroups.forEach(function (g) { g.files.forEach(function (f) { thumbs.push(f.id); }); });
    // v0.9.913 (Brad): desktop shows a two-column split — details on the left,
    // a big full-res photo filling the right half so you can read the label
    // without a separate zoom. Phone stays stacked (small screen).
    var _wide = !window.IS_MOBILE_UA && (window.innerWidth || 0) >= 900;
    var _mainFid = thumbs[0];

    // v0.9.963 (Brad): answer-first layout. The read summary + catalog details
    // lead the card in a readable size (that's what you came to see); the number
    // box and actions follow; research helpers sit at the bottom. No emoji.
    // v0.9.969 (Brad): shared button area — number box, then two columns: LEFT
    // the 1×3 "what to do" stack (Add / Sales List / Discard), RIGHT the 2×2
    // "not sure" grid (re-scan / Research Number / Google Search / token read)
    // with the daily token count beneath it. Same block on desktop and phone;
    // the two columns sit side by side when there's room and stack when narrow.
    var _lbl = 'font-size:0.74rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;margin:0 0 0.5rem';
    var _gBtn = 'padding:0.62rem 0.5rem;border-radius:9px;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer;line-height:1.2;';
    // Offered, not entered. Tapping it fills the box and runs the lookup, which
    // is the same thing pre-filling did — except the user chose it.
    var _guessChip = sugGuess
      ? '<div style="margin-bottom:0.55rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">'
        + '<span style="font-size:0.76rem;color:var(--text-dim)">Best guess from the photo:</span>'
        + '<button onclick="_pinPickNum(\'' + rrEsc(sugGuess).replace(/'/g, '') + '\')" '
        + 'style="padding:0.4rem 0.8rem;border-radius:999px;border:1.5px solid #ffb454;background:var(--bg-card);background:color-mix(in srgb, rgb(255,180,84) 12%, var(--bg-card));'
        + 'color:#ffb454;font-family:var(--font-mono);font-weight:700;font-size:0.86rem;min-height:38px;cursor:pointer">'
        + rrEsc(sugGuess) + ' \u2014 use this</button>'
        + '</div>'
      : '';
    // ══ v0.9.1114 — add the WHOLE SET from a photo group (Brad: "when trying
    // to add a photo group, it just tried to enter the engine, not the set").
    // Every member photo has carried its own read since v0.9.1090; when two or
    // more members have numbers, the group can enter the wizard's existing SET
    // flow with those numbers pre-entered — the set-suggestion engine matches
    // them against the Sets catalog and the per-item walkthrough does the rest.
    var _setNums = [];
    try {
      var _idsA = _ids();
      _pinFilesToRead(_rvGroups[0]).forEach(function (fS) {
        var sS = fS && _idsA[fS.id];
        var nS = (sS && sS.num) ? String(sS.num).trim() : '';
        if (nS && _setNums.indexOf(nS) < 0) _setNums.push(nS);
      });
    } catch (eSN) {}
    // v0.9.1176 (Brad: "if all the items are id \u2026 we should be able to suggest
    // a set"). The numbers were already being collected for the button; the
    // Sets catalog can be asked what they add up to, and if it recognises them
    // the card names the set instead of just counting the reads.
    //
    // The line says how many of the read numbers matched, because "this looks
    // like set X" with no evidence behind it is the kind of confident wrong
    // answer this app has spent a lot of versions removing.
    var _setGuess = null;
    try { _setGuess = _pinSetGuess(_setNums); } catch (eSG) {}
    var _setLine = _setGuess
      ? '<div style="border:1.5px solid var(--forsale);background:var(--surface2);border-radius:10px;padding:0.6rem 0.75rem;margin-bottom:0.5rem;font-size:0.84rem;color:var(--text);line-height:1.45">'
        + 'This looks like <b>set ' + rrEsc(_setGuess.setNum) + '</b>'
        + (_setGuess.setName ? ' \u2014 ' + rrEsc(_setGuess.setName) : '')
        + (_setGuess.year ? ' (' + rrEsc(_setGuess.year) + ')' : '')
        + '<div style="font-size:0.76rem;color:var(--text-dim);margin-top:0.25rem">'
        + _setGuess.matched + ' of the ' + _setGuess.of + ' number' + (_setGuess.of > 1 ? 's' : '') + ' read '
        + (_setGuess.matched === 1 ? 'is' : 'are') + ' in that set'
        + (_setGuess.pieces ? ', which has ' + _setGuess.pieces + ' pieces' : '') + '.</div>'
        + '</div>'
      : '';
    var _setBtn = (_setNums.length >= 2)
      ? _setLine
        + '<button onclick="_pinAddSetFromGroup()" style="width:100%;padding:0.72rem;border-radius:10px;border:2px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 12%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-weight:700;font-size:0.93rem;cursor:pointer;margin-bottom:0.5rem">\ud83d\ude82 '
        + (_setGuess ? 'Add set ' + rrEsc(_setGuess.setNum) : 'Add the whole set')
        + ' \u2014 ' + _setNums.length + ' items read</button>'
      : '';
    var _btnArea =
      _guessChip +
      '<input id="pin-rv-num" list="pin-rv-list" type="text" value="' + sug.replace(/"/g, '&quot;') + '" placeholder="Item number — e.g. 2343 or 6464-1" autocomplete="off" spellcheck="false" oninput="_pinReviewLookup(this.value)" style="width:100%;box-sizing:border-box;padding:0.6rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;margin-bottom:0.55rem">' +
      '<datalist id="pin-rv-list">' + opts + '</datalist>' +
      _pinAltChips() +
      '<div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-top:0.35rem">' +
        '<div style="flex:1 1 240px;min-width:0">' +
          '<div style="' + _lbl + '">What do you want to do with it?</div>' +
          _setBtn +
          '<button id="pin-rv-add" onclick="_pinFileToCollection()" class="btn-primary" style="width:100%;padding:0.72rem;border-radius:10px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.93rem;cursor:pointer;margin-bottom:0.5rem">Add to my Collection</button>' +
          '<button id="pin-rv-sell" onclick="_pinSendForSale()" style="width:100%;padding:0.68rem;border-radius:10px;border:1.5px solid #d4a843;background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 12%, var(--bg-card));color:#d4a843;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;margin-bottom:0.5rem">Add to Sales List</button>' +
          // v0.9.1387 (Brad, on a photo of a Lionel engineering blueprint):
          // "it forces you to enter an item number for something that doesn't
          // have one. this paper item should be manually entered." Always
          // shown, never conditional on the read: his blueprint DID produce
          // numbers and a confident-looking catalog guess, so a button that
          // only appeared when nothing was read would have missed the very
          // case that prompted it.
          '<button id="pin-rv-nonum" onclick="_pinAddNoNumber()" style="width:100%;padding:0.68rem;border-radius:10px;border:1.5px solid var(--info);background:var(--bg-card);background:color-mix(in srgb, var(--info) 12%, var(--bg-card));color:var(--info);font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;margin-bottom:0.5rem">No item number — enter it myself</button>' +
          '<button onclick="_pinReviewDiscard()" style="width:100%;padding:0.68rem;border-radius:10px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Discard Photo' + (n > 1 ? 's' : '') + '</button>' +
        '</div>' +
        '<div style="flex:1 1 240px;min-width:0">' +
          '<div style="' + _lbl + '">Not sure what it is?</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
            '<button id="pin-rv-rescan" onclick="_pinRescan()" title="Forget this read and scan the photo again at higher detail" style="' + _gBtn + 'border:1.5px solid #f05008;background:var(--bg-card);background:color-mix(in srgb, rgb(240,80,8) 10%, var(--bg-card));color:#f05008">This is wrong — re-scan</button>' +
            '<button onclick="_pinReviewResearch()" style="' + _gBtn + 'border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9">Research Number</button>' +
            '<button id="pin-rv-lens" onclick="_pinReviewLens()" style="' + _gBtn + 'border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:#2980b9">Google Search</button>' +
            // v0.9.1163: don't quote a price the app will not charge. With reads
            // switched off this button still said "(1 token)" and then reported a
            // failure, which is how Brad ended up thinking it was broken.
            '<button id="pin-rv-idtoken" onclick="_pinReviewIdentify()" title="'
              + ((typeof rrAiOptedOut === 'function' && rrAiOptedOut())
                  ? 'Photo ID reads are off — turn them on in Preferences › Photo ID'
                  : 'Identify this item straight from its photo — uses one photo ID')
              + '" style="' + _gBtn + 'border:1.5px solid var(--accent2,#d4a843);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 14%, var(--bg-card));color:var(--accent2,#d4a843)">'
              + ((typeof rrAiOptedOut === 'function' && rrAiOptedOut())
                  ? 'Read this photo (photo ID reads are off)'
                  : 'Read this photo (1 photo ID)') + '</button>' +
          '</div>' +
          _tokLine() +
          // v0.9.1181 (Brad): "a big button underneath the 2x2 grid buttons on
          // the right… what each button does and what it costs… the steps to
          // follow." The copy lives in help-photo-id.js.
          '<button onclick="_pinHelpOpen()" style="width:100%;margin-top:0.15rem;padding:0.72rem;'
            + 'border-radius:10px;border:1.5px solid var(--info);background:var(--surface2);'
            + 'color:var(--info);font-family:var(--font-body);font-weight:700;font-size:0.9rem;'
            + 'cursor:pointer">How best to use these features</button>' +
        '</div>' +
      '</div>';

    var _controlsHtml =
      (_pinLensGroups ? _pinLensBannerHtml() : '') +   // v0.9.962: waiting-for-answer reminder after Research by Photo
      _pinAiLine() +
      '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;margin-bottom:0.7rem;display:flex;flex-direction:column;gap:0.4rem"></div>' +
      _btnArea;

    // Phone: horizontal strip on top (unchanged).
    var _stripHtml =
      '<div id="pin-rv-photos" style="display:flex;gap:0.45rem;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:0.7rem">' +
        thumbs.slice(0, 12).map(function (fidT, i) {
          return '<div data-dragfid="' + fidT + '" style="position:relative;flex-shrink:0;width:' + (i === 0 ? '160px;height:160px' : '74px;height:74px;align-self:flex-end') + ';border-radius:10px;overflow:hidden;background:var(--surface2,#26262e)">' +
            (i === 0 ? '<div style="position:absolute;top:0;left:0;background:var(--accent);color:#fff;font-size:0.55rem;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:0 0 6px 0;z-index:2;pointer-events:none">MAIN VIEW</div>' : '') +
            '<img data-rvfid="' + fidT + '" onclick="_pinZoomPhoto(\'' + fidT + '\')" title="Tap to view full size — zoom in to read the label" style="width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in" alt="">' +
            '<button onclick="event.stopPropagation();_pinZoomPhoto(\'' + fidT + '\')" title="View full size" style="position:absolute;left:4px;bottom:4px;width:26px;height:26px;border-radius:7px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.8rem;line-height:1;cursor:pointer;padding:0">🔍</button>' +
            '<button onclick="event.stopPropagation();_pinCropPhoto(\'' + fidT + '\')" title="Crop / Rotate this photo" style="position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:7px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.85rem;line-height:1;cursor:pointer;padding:0">✂</button>' +
            (function () {
              var _tS = _ids()[fidT];
              var _tN = (_tS && _tS.num) ? String(_tS.num) : '';
              return _tN ? '<div style="position:absolute;left:34px;right:34px;bottom:4px;background:rgba(0,0,0,0.62);color:' + (_tS.guess ? '#ffb454' : '#7ec3ef') + ';font-size:0.6rem;font-weight:700;text-align:center;padding:1px 3px;border-radius:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + rrEsc(_tN) + '</div>' : '';
            })() +
          '</div>';
        }).join('') +
      '</div>';

    // Desktop: big photo panel on the right; other photos as a strip beneath.
    var _cornBtn = 'position:absolute;width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:0.9rem;line-height:1;cursor:pointer;padding:0;z-index:2';
    var _panelHtml =
      '<div style="flex:1 1 50%;min-width:0;display:flex;flex-direction:column;gap:0.5rem">' +
        '<div style="position:relative;flex:1;min-height:360px;border-radius:12px;overflow:hidden;background:var(--surface2,#26262e);display:flex;align-items:center;justify-content:center">' +
          '<img id="pin-rv-main" data-rvbig="' + _mainFid + '" onclick="_pinZoomPhoto(this.getAttribute(\'data-rvbig\'))" title="Tap for full-screen zoom" style="max-width:100%;max-height:74vh;object-fit:contain;display:block;cursor:zoom-in" alt="">' +
          '<button onclick="_pinZoomPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Full-screen zoom" style="' + _cornBtn + ';left:8px;bottom:8px">🔍</button>' +
          '<button onclick="_pinCropPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Crop / Rotate this photo" style="' + _cornBtn + ';top:8px;right:8px">✂</button>' +
        '</div>' +
        (thumbs.length > 1
          ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;-webkit-overflow-scrolling:touch">' +
              thumbs.slice(0, 12).map(function (fidT, i) {
                var _tSug = _ids()[fidT];
                var _tNum = (_tSug && _tSug.num) ? String(_tSug.num) : '';
                return '<div data-dragfid="' + fidT + '" onclick="_pinRvSetMain(\'' + fidT + '\')" title="Show this photo — drag to reorder" style="position:relative;flex-shrink:0;width:64px;height:64px;border-radius:8px;overflow:hidden;background:var(--surface2,#26262e);cursor:pointer;border:1.5px solid transparent">' +
                  (i === 0 ? '<div style="position:absolute;top:0;left:0;background:var(--accent);color:#fff;font-size:0.55rem;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:0 0 6px 0;z-index:2;pointer-events:none">MAIN VIEW</div>' : '') +
                  '<img data-rvfid="' + fidT + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="">' +
                  (_tNum ? '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);color:' + (_tSug.guess ? '#ffb454' : '#7ec3ef') + ';font-size:0.58rem;font-weight:700;text-align:center;padding:1px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + rrEsc(_tNum) + '</div>' : '') +
                  '</div>';
              }).join('') +
            '</div>'
          : '') +
      '</div>';

    // v0.9.964 (Brad): DESKTOP layout — the "From the photo" read and the
    // catalog details sit as full-width boxes across the TOP, the photo fills
    // the middle full-width, and the action buttons run in a row across the
    // BOTTOM. (Phone stays stacked below.)
    var _photoWide =
      '<div style="position:relative;border-radius:12px;overflow:hidden;background:var(--surface2,#26262e);display:flex;align-items:center;justify-content:center;max-height:52vh;margin-bottom:0.5rem">' +
        '<img id="pin-rv-main" data-rvbig="' + _mainFid + '" onclick="_pinZoomPhoto(this.getAttribute(\'data-rvbig\'))" title="Tap for full-screen zoom" style="max-width:100%;max-height:52vh;object-fit:contain;display:block;cursor:zoom-in" alt="">' +
        '<button onclick="_pinZoomPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Full-screen zoom" style="' + _cornBtn + ';left:8px;bottom:8px">🔍</button>' +
        '<button onclick="_pinCropPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Crop / Rotate this photo" style="' + _cornBtn + ';top:8px;right:8px">✂</button>' +
      '</div>' +
      (thumbs.length > 1
        ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:0.6rem">' +
            thumbs.slice(0, 12).map(function (fidT, i) {
              return '<div data-dragfid="' + fidT + '" onclick="_pinRvSetMain(\'' + fidT + '\')" title="Show this photo — drag to reorder" style="position:relative;flex-shrink:0;width:64px;height:64px;border-radius:8px;overflow:hidden;background:var(--surface2,#26262e);cursor:pointer;border:1.5px solid transparent">' +
                (i === 0 ? '<div style="position:absolute;top:0;left:0;background:var(--accent);color:#fff;font-size:0.55rem;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:0 0 6px 0;z-index:2;pointer-events:none">MAIN VIEW</div>' : '') +
                '<img data-rvfid="' + fidT + '" style="width:100%;height:100%;object-fit:cover;display:block" alt=""></div>';
            }).join('') +
          '</div>'
        : '');
    var _aiL = _pinAiLine(_mainFid), _chips = _pinAltChips();
    var _wideBtn = 'flex:1 1 160px;padding:0.72rem 0.6rem;border-radius:10px;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;';
    var _wideBody =
      (_pinLensGroups ? _pinLensBannerHtml() : '') +
      // Top: two full-width info boxes above the photo (or just details if no read yet).
      (_aiL
        ? '<div style="display:flex;gap:1rem;align-items:stretch;margin-bottom:0.8rem">' +
            '<div id="pin-rv-ailine" style="flex:1.25;min-width:0">' + _aiL + '</div>' +
            '<div style="flex:1;min-width:0"><div id="pin-rv-info" style="height:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;display:flex;flex-direction:column;gap:0.4rem"></div></div>' +
          '</div>'
        : '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;margin-bottom:0.8rem;display:flex;flex-direction:column;gap:0.4rem"></div>') +
      _photoWide +
      _btnArea;

    var ov = document.createElement('div');
    ov.id = 'pin-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML =
      '<div class="rr-card"' + (_wide ? ' style="max-width:820px"' : '') + '>' +
        '<div id="pin-rv-nav" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">' +
          _pinRvNavHtml('prev') +
          '<div style="flex:1;min-width:0;font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _pinRvTitle(n) + '</div>' +
          _pinRvPosHtml() +
          _pinRvNavHtml('next') +
          '<button onclick="_pinCloseReview()" style="background:none;border:none;color:var(--text-dim);font-size:1.35rem;line-height:1;cursor:pointer;padding:0.1rem 0.3rem;margin-left:0.25rem">✕</button>' +
        '</div>' +
        (_wide ? _wideBody : _stripHtml + _controlsHtml) +
      '</div>';
    document.body.appendChild(ov);
    // v0.9.1283 (Brad: "i need to be able to drag the pictures back and
    // forth. have a box on the first one that says 'main view'"). Wire every
    // thumb strip on the card. The first photo IS the main view — it leads
    // the card, and on an add it files as the cover/Right Side View — so the
    // badge and the drag are two halves of one fact.
    try { _pinWireRvDrag(ov); } catch (eDr) {}
    // v0.9.1181: first review card this browser has ever opened — show the help
    // once, unprompted, because a button nobody taps helps nobody.
    try {
      if (!_pinHelpSeen()) setTimeout(function () { window._pinHelpOpen(true); }, 350);
    } catch (eH) {}
    ov.querySelectorAll('img[data-rvfid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-rvfid'), img, img.parentElement, null, 'hi');
    });
    try { _pinDemoteAdd(false); } catch (eD) {}
    var _rvMainImg = document.getElementById('pin-rv-main');
    if (_rvMainImg && window._pinRvLoadFull) window._pinRvLoadFull(_rvMainImg, _rvMainImg.getAttribute('data-rvbig'));
    // Only look up what is actually in the box. A guess left as a chip must not
    // silently produce a Maker / Item # / Description panel — that panel is what
    // made "58" read as a finding rather than a hunch.
    _pinReviewLookup(sug);
  };

  // "From the photo" line — everything the AI read, so a wrong read (e.g. a
  // background box's number) is obvious at a glance. (Brad, 2026-07-16)
  // The stored reasoning for a photo that came back empty.
  function _pinFailInfo() {
    try {
      var fid = _rvGroups && _rvGroups.length ? _pinReadFid(_rvGroups[0]) : '';
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
    if (dbg.joined) out.push('Pieced ' + dbg.joined + ' together from split digits');
    if (dbg.directOverJoin) out.push('Kept the number actually read: ' + dbg.directOverJoin);
    if (dbg.viaMaker) out.push(dbg.viaMaker + ' was stamped next to the maker\u2019s name');
    if ((dbg.inEra || []).length) out.push('In that catalog: ' + dbg.inEra.slice(0, 3).join(', '));
    if ((dbg.offEra || []).length) out.push('In another maker\u2019s catalog: ' + dbg.offEra.slice(0, 3).join(', '));
    if (dbg.quoted) out.push('The catalog itself quotes that number: ' + dbg.quoted);
    if (dbg.repaired) out.push('One digit looked misread — corrected to ' + dbg.repaired);
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
      + (raw ? 'The free reader saw: \u201c' + rrEsc(raw) + '\u201d'
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

  function _pinAiLine(fid) {
    var s = {};
    // v0.9.1087: the readable photo, matching where every reader now WRITES.
    // v0.9.1090: or the photo actually ON SCREEN — in a set, each member has
    // its own read, and the line describes what you are looking at.
    // v0.9.1091 (Brad: "got nothing"): the on-screen photo's slot may simply
    // not have been read YET — per-member reads are new, and the re-read storm
    // takes a while. An empty slot falls back to the group's readable slot, so
    // a read that exists is never hidden by keying on the wrong photo.
    try {
      var ids0 = _ids();
      s = (fid && ids0[fid])
        || ids0[_pinReadFid(_rvGroups[0]) || _rvGroups[0].files[0].id]
        || {};
    } catch (e) {}
    var bits = [s.mfr, s.road, s.desc, s.year ? '(' + s.year + ')' : ''].filter(Boolean).join(' ');
    if (!bits && !s.num) return '';
    var esc = function (t) { return String(t).replace(/</g, '&lt;'); };
    // v0.9.1152 (Brad: "our ai and google lens come back with atlas, mth, ho
    // guage"). Even with the maker and scale now stated in the question, a
    // reader can still answer outside the filter. Say so on the card instead of
    // presenting it as a plain fact — an unflagged "MTH" while filtered to
    // Lionel Modern is how a wrong maker gets saved without anyone noticing.
    var _mismatch = '';
    try {
      var _af = (typeof rrActiveFilter === 'function') ? rrActiveFilter() : null;
      if (_af && _af.manufacturer && s.mfr) {
        var _n = function (v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
        var _said = _n(s.mfr), _want = _n(_af.manufacturer);
        if (_said && _want && _said.indexOf(_want) < 0 && _want.indexOf(_said) < 0) {
          _mismatch = '<div style="margin-top:0.35rem;font-size:0.75rem;color:#e8a020">'
            + '⚠ Reads as ' + esc(s.mfr) + ', but you are filtered to ' + esc(_af.label)
            + '. Check before saving — or switch era if that is right.</div>';
        }
      }
      if (_af && _af.scale && s.gauge && typeof rrSameScale === 'function'
          && !rrSameScale(s.gauge, _af.scale)) {
        _mismatch += '<div style="margin-top:0.35rem;font-size:0.75rem;color:#e8a020">'
          + '⚠ Reads as ' + esc(s.gauge) + ' scale, but you are filtered to '
          + esc(_af.scale) + '.</div>';
      }
    } catch (eMM) {}
    // v0.9.898: hedged reads show as an explicit BEST GUESS (orange), never
    // dressed up like a confident read.
    // v0.9.1077: when the identification came from the WORDS on the car rather
    // than a number, say so plainly and name what matched — the whole value of
    // this route is that the user can confirm or kill it at a glance.
    if (s.viaDesc && s.descOf) {
      return '<div style="margin-bottom:0.6rem;padding:0.6rem 0.75rem;border-left:3px solid #b98cff;background:rgba(185,140,255,0.08);border-radius:0 8px 8px 0">'
        + '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:#b98cff;margin-bottom:0.25rem">Matched by what is written on it</div>'
        + '<div style="font-size:0.98rem;color:var(--text);line-height:1.4"><span style="font-weight:600">' + rrEsc(s.descOf) + '</span>'
        + (s.num ? ' \u2014 No. ' + rrEsc(s.num) : '') + '</div>'
        + _mismatch
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">Read on the car: '
        + rrEsc((s.descWords || []).join(', '))
        // v0.9.1094: when a number WAS read and it names a different item,
        // saying "no number was legible" is false and Brad-tested to annoy.
        // Name both candidates and let the eyes on the car decide.
        + (s.disagreed
            ? ' \u00b7 the number read (' + rrEsc(s.disagreed) + ') names a different item \u2014 check which one matches yours'
            : ' \u00b7 no number was legible, so check this one against your item') + '</div>'
        + _pinWhyHtml(s.raw, s.dbg, s)
        + '</div>';
    }
    var col = s.guess ? '#ffb454' : '#7ec3ef';
    var bg  = s.guess ? 'rgba(255,180,84,0.08)' : 'rgba(41,128,185,0.06)';
    var lbl = s.guess ? 'Best guess from the photo:' : 'From the photo:';
    var tail = s.guess ? ' · not certain — double-check against your item' : ' · double-check this against your item';
    // v0.9.963 (Brad): bigger, answer-first — the description reads as the
    // headline, with a small colored label above and the caution note below.
    return '<div style="margin-bottom:0.6rem;padding:0.6rem 0.75rem;border-left:3px solid ' + col + ';background:' + bg + ';border-radius:0 8px 8px 0">' +
      '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:' + col + ';margin-bottom:0.25rem">' + lbl.replace(/:$/, '') + '</div>' +
      '<div style="font-size:0.98rem;color:var(--text);line-height:1.4"><span style="font-weight:600">' + (bits ? esc(bits) : 'number only') + '</span>' + (s.num ? ' — No. ' + esc(s.num) : '') + '</div>' +
      _mismatch +
      '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">' + tail.replace(/^ · /, '') + '</div>' +
      // v0.9.1087: ONE disclosure builder. This inline copy predated
      // _pinWhyHtml and was gated on s.raw — the FREE reader's text — so a paid
      // read, which stores aiRaw instead, showed no disclosure at all. That is
      // the literal answer to Brad's "what disclosure": for paid reads there
      // never was one. Two copies of an explanation is how they end up
      // disagreeing; now there is one.
      _pinWhyHtml(s.raw, s.dbg, s) +
      '</div>';
  }

  // v0.9.901 (Brad): pick-one chips when the AI listed look-alike variants —
  // the ★ chip is its best guess; tapping any chip fills the number box and
  // runs the catalog lookup so the descriptions tell the twins apart.
  function _pinAltChips() {
    var s = {};
    try { s = _ids()[_rvGroups[0].files[0].id] || {}; } catch (e) {}
    var alts = Array.isArray(s.alts) ? s.alts.slice(0) : [];
    if (!alts.length) return '';
    var primary = String(s.num || '');
    var esc = function (t) { return String(t).replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    var covered = alts.some(function (a) { return primary && a.indexOf(primary) > -1; });
    if (primary && !covered) alts.unshift(primary + ' (best guess)');
    var chips = alts.map(function (a) {
      var m = String(a).match(/[0-9][0-9A-Za-z.\-\/]*/);
      var n = m ? m[0] : '';
      var hot = !!(n && primary && n === primary);
      return '<button onclick="_pinPickNum(\'' + esc(n) + '\')" style="padding:0.35rem 0.6rem;border-radius:8px;border:1.5px solid ' + (hot ? '#ffb454' : 'var(--border)') + ';background:' + (hot ? 'rgba(255,180,84,0.14)' : 'var(--surface2)') + ';color:' + (hot ? '#ffb454' : 'var(--text-mid)') + ';font-size:0.75rem;font-weight:700;cursor:pointer;font-family:var(--font-body)">' + (hot ? '★ ' : '') + esc(a) + '</button>';
    }).join('');
    return '<div style="margin-bottom:0.6rem">' +
      '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.3rem">Could be one of these — tap each to compare (★ = best guess):</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.4rem">' + chips + '</div></div>';
  }

  window._pinPickNum = function (n) {
    var i = document.getElementById('pin-rv-num');
    if (i) i.value = n || '';
    window._pinReviewLookup(n || '');
  };

  // Research by Photo — the app's existing Lens route (stage the photo
  // publicly for 10 minutes, open Google image search with a structured
  // question). Same machinery the wizard's identify uses.
  // ══ v0.9.1178 — where do you want to look? ═══════════════════════════════
  // Brad: "with the google search, we need a pop up to add 'where from' that has
  // vendors listed, we need any, ebay, and have the ability to add vendors
  // manually. these would be like trainz.com, trainworld, ect. I DON'T WANT TO
  // SUGGEST VENDORS, THE USER NEEDS TO MANUALLY PUT THEM IN."
  //
  // ⚠ READ THAT LAST SENTENCE BEFORE CHANGING THIS CODE. There is no seeded
  // list here, no "popular dealers", no autocomplete from a bundled set, and no
  // vendor is ever written to storage that the user did not type. trainz.com and
  // trainworld appear in his message as examples of what HE would enter — they
  // are not a starter list, and shipping them as one would be the opposite of
  // what he asked for. The list below starts EMPTY and stays empty until he
  // types into it.
  //
  // "Any" and "eBay" are not vendors the app is suggesting: they are the two
  // scopes Brad named by hand in that same sentence. Any is "don't narrow it",
  // which is the behaviour that already existed.
  var VENDOR_KEY = 'rr_vendors';        // [{name, site}] — user-entered ONLY
  var VENDOR_LAST_KEY = 'rr_vendor_last';
  function _pinVendors() {
    try {
      var a = JSON.parse(localStorage.getItem(VENDOR_KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (v) { return v && v.site; }) : [];
    } catch (e) { return []; }
  }
  function _pinVendorsSave(a) {
    try { localStorage.setItem(VENDOR_KEY, JSON.stringify(a || [])); } catch (e) {}
  }
  // Turn whatever was typed into a domain we can scope a search to. Anything
  // that is not recognisably a web address is refused with a reason rather than
  // stored as junk that silently produces an empty search later.
  function _pinVendorDomain(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
    s = s.split(/[\/?#\s]/)[0];
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : '';
  }
  window._pinAddVendor = function () {
    var box = document.getElementById('pin-wf-new');
    var raw = box ? box.value : '';
    var dom = _pinVendorDomain(raw);
    if (!dom) {
      showToast('Type the vendor’s web address, like trainz.com', 3200, true);
      return;
    }
    var list = _pinVendors();
    if (list.some(function (v) { return v.site === dom; })) {
      showToast(dom + ' is already on the list', 2400, true);
      return;
    }
    list.push({ name: dom, site: dom });
    _pinVendorsSave(list);
    if (box) box.value = '';
    _pinWhereFromDraw();
  };
  window._pinRemoveVendor = function (site) {
    var list = _pinVendors().filter(function (v) { return v.site !== site; });
    _pinVendorsSave(list);
    try {
      if (localStorage.getItem(VENDOR_LAST_KEY) === site) localStorage.removeItem(VENDOR_LAST_KEY);
    } catch (e) {}
    _pinWhereFromDraw();
  };

  // The scopes offered, in order. Built fresh every draw so a vendor added in
  // the sheet appears immediately.
  function _pinWhereFromOptions() {
    var out = [
      { site: '', label: 'Any site', note: 'Search the whole web' },
      { site: 'ebay.com', label: 'eBay', note: '' },
    ];
    var seen = { 'ebay.com': 1 };
    _pinVendors().forEach(function (v) {
      if (seen[v.site]) return;
      seen[v.site] = 1;
      out.push({ site: v.site, label: v.name || v.site, note: '', mine: true });
    });
    // v0.9.1179 (Brad): "This can be from our contact list as well. On the
    // contact list, we can have a box added to the contacts detail page that
    // says preferred vendor. Then if they click that, it can populate the google
    // where from pop up."
    //
    // Still not the app suggesting anything: every one of these is a contact he
    // typed in himself and then ticked. They carry no remove button — taking one
    // off means un-ticking the contact, and a ✕ here that quietly edited a
    // contact record would be a nasty surprise.
    try {
      if (typeof window._ctPreferredVendors === 'function') {
        window._ctPreferredVendors().forEach(function (v) {
          if (!v || !v.site || seen[v.site]) return;
          seen[v.site] = 1;
          out.push({ site: v.site, label: v.name || v.site, note: 'From your contacts' });
        });
      }
    } catch (e) {}
    return out;
  }
  var _pinWfCb = null;
  function _pinWhereFromDraw() {
    var card = document.getElementById('pin-wf-card');
    if (!card) return;
    var last = '';
    try { last = localStorage.getItem(VENDOR_LAST_KEY) || ''; } catch (e) {}
    var opts = _pinWhereFromOptions();
    if (!opts.some(function (o) { return o.site === last; })) last = '';
    var rowBtn = 'width:100%;text-align:left;padding:0.7rem 0.8rem;border-radius:9px;'
      + 'font-family:var(--font-body);font-size:0.92rem;min-height:48px;cursor:pointer;'
      + 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.45rem';
    card.innerHTML =
      '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;margin-bottom:0.15rem">Where do you want to look?</div>'
      + '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.8rem">'
      + 'Pick a place to search this item. Only the vendors you add yourself appear here.</div>'
      + opts.map(function (o) {
          var on = o.site === last;
          return '<div style="display:flex;align-items:center;gap:0.4rem">'
            + '<button onclick="_pinWhereFromPick(\'' + rrEsc(o.site) + '\')" style="' + rowBtn
              + ';border:1.5px solid ' + (on ? 'var(--accent)' : 'var(--border)') + ';background:'
              + (on ? 'var(--surface3)' : 'var(--surface2)') + ';color:var(--text);flex:1;min-width:0">'
            + '<span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + rrEsc(o.label) + '</span>'
            + (o.note ? '<span style="font-size:0.74rem;color:var(--text-dim);font-weight:400">' + rrEsc(o.note) + '</span>' : '')
            + '</button>'
            + (o.mine
                ? '<button onclick="_pinRemoveVendor(\'' + rrEsc(o.site) + '\')" title="Remove ' + rrEsc(o.label)
                  + '" aria-label="Remove ' + rrEsc(o.label) + '" style="width:40px;min-width:40px;height:40px;border-radius:9px;'
                  + 'border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);'
                  + 'font-size:1.1rem;line-height:1;cursor:pointer;padding:0;margin-bottom:0.45rem">✕</button>'
                : '')
            + '</div>';
        }).join('')
      + '<div style="border-top:1px solid var(--border);margin:0.7rem 0 0.6rem"></div>'
      + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);font-weight:700;margin-bottom:0.3rem">Add a vendor</div>'
      + '<div style="display:flex;gap:0.5rem;align-items:stretch">'
        + '<input id="pin-wf-new" type="text" placeholder="Their web address, like trainz.com" autocomplete="off" spellcheck="false" '
          + 'style="flex:1;min-width:0;padding:0.6rem 0.7rem;border-radius:8px;border:1.5px solid var(--border);'
          + 'background:var(--surface2);color:var(--text);font-size:0.95rem;min-height:46px;box-sizing:border-box">'
        + '<button onclick="_pinAddVendor()" style="padding:0 1rem;border-radius:8px;border:1.5px solid var(--border);'
          + 'background:var(--surface2);color:var(--text);font-weight:700;font-size:0.9rem;min-height:46px;cursor:pointer">Add</button>'
      + '</div>'
      + '<button onclick="_pinWhereFromClose()" style="width:100%;margin-top:0.8rem;padding:0.6rem;border-radius:9px;border:none;background:none;color:var(--text-dim);font-size:0.88rem;cursor:pointer">Cancel</button>';
    var nb = document.getElementById('pin-wf-new');
    if (nb) nb.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); window._pinAddVendor(); } };
  }
  window._pinWhereFromClose = function () {
    var ov = document.getElementById('pin-wf-sheet');
    if (ov) ov.remove();
    _pinWfCb = null;
  };
  window._pinWhereFromPick = function (site) {
    try { if (site) localStorage.setItem(VENDOR_LAST_KEY, site); else localStorage.removeItem(VENDOR_LAST_KEY); } catch (e) {}
    var cb = _pinWfCb;
    var label = '';
    _pinWhereFromOptions().forEach(function (o) { if (o.site === site) label = o.label; });
    window._pinWhereFromClose();
    if (cb) { try { cb({ site: site, label: label }); } catch (e) { console.warn('[inbox] where-from callback', e && e.message); } }
  };
  function _pinWhereFrom(cb) {
    _pinWfCb = cb;
    var old = document.getElementById('pin-wf-sheet'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-wf-sheet';
    ov.style.cssText = _PIN_SHEET_OV;
    var card = document.createElement('div');
    card.id = 'pin-wf-card';
    card.style.cssText = _pinSheetCardCss(520, 82);
    ov.appendChild(card);
    ov.onclick = function (e) { if (e.target === ov) window._pinWhereFromClose(); };
    document.body.appendChild(ov);
    _pinWhereFromDraw();
    // v0.9.1179: contacts only load when the Contacts page has been opened, so a
    // ticked vendor would be missing from this sheet on a fresh session. Fetch
    // them once, quietly, and redraw if any turned up — the same lazy load the
    // wizard's "Bought From" picker does.
    try {
      if (!(window.state && (window.state.contactsData || []).length)
          && typeof window._ctLoadContacts === 'function') {
        window._ctLoadContacts().then(function () {
          if (document.getElementById('pin-wf-card')) _pinWhereFromDraw();
        }).catch(function () {});
      }
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    window._pinVendors = _pinVendors;
    window._pinVendorDomain = _pinVendorDomain;
    window._pinWhereFromOptions = _pinWhereFromOptions;
    window._pinWhereFrom = _pinWhereFrom;
  }

  // A search narrowed to one site. Google's site: operator does the narrowing;
  // the rest of the query is the same maker/period wording the app already uses
  // everywhere else, so the results look like the ones from the item detail page.
  window._pinVendorSearchURL = function (site, num, hints) {
    var bits = ['site:' + String(site || '')];
    var h = hints || {};
    if (h.mfr) bits.push(h.mfr);
    if (num) bits.push(String(num));
    if (h.road) bits.push(h.road);
    if (h.period) bits.push(h.period);
    return 'https://www.google.com/search?q=' + encodeURIComponent(bits.join(' '));
  };

  // ══ v0.9.1181 — the help panel ═══════════════════════════════════════════
  // Brad chose: it opens itself ONCE, on the very first review card a new user
  // ever sees, and after that only from the button. The flag is set the moment
  // it is shown rather than when it is dismissed — "once" has to mean once even
  // if they close it straight away, or it becomes the thing that nags.
  var HELP_SEEN_KEY = 'rr_photoid_help_seen';
  function _pinHelpSeen() {
    try { return localStorage.getItem(HELP_SEEN_KEY) === '1'; } catch (e) { return true; }
  }
  function _pinHelpMarkSeen() {
    try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch (e) {}
  }
  window._pinHelpClose = function () {
    var ov = document.getElementById('pin-help-sheet');
    if (ov) ov.remove();
  };
  window._pinHelpOpen = function (auto) {
    if (typeof window.rrPhotoIdHelpHtml !== 'function') return;
    var old = document.getElementById('pin-help-sheet'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-help-sheet';
    // z-index above the review card's own overlay, or it opens behind it.
    ov.style.cssText = _PIN_SHEET_OV.replace('z-index:10050', 'z-index:10060');
    var card = document.createElement('div');
    card.style.cssText = _pinSheetCardCss(560, 88);
    card.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:0.5rem">'
        + '<div style="flex:1;min-width:0;font-family:var(--font-head);font-size:1.2rem;'
          + 'font-weight:700;color:var(--text);line-height:1.25">How best to use these features</div>'
        + '<button onclick="_pinHelpClose()" aria-label="Close" style="background:none;border:none;'
          + 'color:var(--text-dim);font-size:1.35rem;line-height:1;cursor:pointer;'
          + 'padding:0.1rem 0.3rem;flex-shrink:0">\u2715</button>'
      + '</div>'
      + window.rrPhotoIdHelpHtml()
      + '<button onclick="_pinHelpClose()" style="width:100%;margin-top:1.1rem;padding:0.75rem;'
        + 'border-radius:10px;border:none;background:var(--accent);color:var(--on-accent);'
        + 'font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer">'
        + (auto ? 'Got it \u2014 don\u2019t show this again' : 'Close') + '</button>';
    ov.appendChild(card);
    ov.onclick = function (e) { if (e.target === ov) window._pinHelpClose(); };
    document.body.appendChild(ov);
    _pinHelpMarkSeen();
  };

  // v0.9.1184 (Brad: "I told you to add the prefered vendor to the research
  // google button. instead, you screw with google lens.") — v0.9.1178 put the
  // where-from picker HERE, in front of the photo search. Wrong button. His
  // request said "with the google search" and meant the plain text-search
  // Google buttons (Parts Needed's, for one) — not the photo flow, which was
  // one click and became two. The picker now lives on googlePart
  // (app-pages.js); this button is the photo search again, full stop.
  // v0.9.1184 (Brad: "I told you to add the prefered vendor to the research
  // google button. instead, you screw with google lens.") — v0.9.1178 put the
  // where-from picker HERE, in front of the photo search. Wrong button. His
  // request said "with the google search" and meant the plain text-search
  // Google buttons (Parts Needed's, for one) — not the photo flow, which was
  // one click and became two. The picker now lives on googlePart
  // (app-pages.js); this button is the photo search again, full stop.
  window._pinReviewLens = function () { return window._pinLensSearch(); };

  window._pinLensSearch = async function () {
    var gs = _rvGroups;
    if (!gs.length) return;
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    var tab = null;
    try { tab = window.open('', '_blank'); } catch (e) {}
    var btn = document.getElementById('pin-rv-lens');
    if (btn) { btn.disabled = true; btn.textContent = 'Staging photo…'; }
    try {
      var blob = await _pinBytes(gs[0].files[0].id);
      var file = new File([blob], 'inbox-photo.jpg', { type: blob.type || 'image/jpeg' });
      var staged = await driveStageLensPhoto(file);
      setTimeout(function () { try { driveCleanupLensStaging(staged.id); } catch (e) {} }, 10 * 60 * 1000);
      // v0.9.917 (Brad): question text built by the ONE shared builder in
      // ai-id.js (rrIdentifyQuery) — change it there, every button updates.
      // v0.9.1083: the same era hint goes into the shared text question, so a
      // Research or Google search is asked about the right decade too.
      var _lh = _pinAiHints(gs[0]);
      // v0.9.1152: this passed ONLY eraLabel/eraYears and dropped the mfrs and
      // scale that _pinAiHints had just worked out — so the question never said
      // "Lionel" or "O". Pass the whole hint set.
      var q = (typeof window.rrIdentifyQuery === 'function')
        ? window.rrIdentifyQuery({ eraLabel: _lh.eraLabel, eraYears: _lh.eraYears,
                                   mfrs: _lh.mfrs, scale: _lh.scale })
        : 'Identify this model railroad item. Provide Manufacturer; Manufacturer SKU or catalog number; Year; Scale; Description on labeled lines.';
      // v0.9.959 (Brad): Google retired /searchbyimage (it 404s now) and moved
      // reverse-image search to Google Lens. uploadbyurl runs the real search on
      // the staged photo. Lens takes no text hint, so `q` is unused here.
      var url = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(staged.url);
      if (tab) { try { tab.location = url; } catch (e) { tab = null; } }
      if (!tab) window.open(url, '_blank');
      if (btn) { btn.disabled = false; btn.textContent = 'Google Search'; }
      // v0.9.895 (Brad: "i copied it, now what?") — same return trip as the
      // wizard's Lens flow: when he comes back with Google's answer copied,
      // parse the clipboard and reopen the review card with it applied.
      _pinLensArm(gs);
      // v0.9.962 (Brad): show the reminder right on the open card now, and it
      // re-renders on the return-trip too (armed state -> banner in _pinReview).
      try {
        var _numEl = document.getElementById('pin-rv-num');
        if (_numEl && !document.getElementById('pin-lens-banner')) {
          var _bWrap = document.createElement('div');
          _bWrap.innerHTML = _pinLensBannerHtml();
          if (_bWrap.firstChild) _numEl.parentNode.insertBefore(_bWrap.firstChild, _numEl);
        }
      } catch (eB) {}
      showToast('In the Google tab: Ctrl+A, Ctrl+C, then come back and press Ctrl+V', 4500);
    } catch (e) {
      console.warn('[Inbox] research-by-photo:', e);
      try { if (tab) tab.close(); } catch (e2) {}
      if (btn) { btn.disabled = false; btn.textContent = 'Google Search'; }
      showToast('Could not stage the photo for Google — try again', 3000, true);
    }
  };

  // v0.9.962 (Brad): the "waiting for Google's answer" reminder shown on the
  // review card after Research by Photo. Can't draw on Google's tab (cross-site
  // security), so the reminder lives here, where the answer comes back.
  // v0.9.1170 (Brad: "when we use the google lens, we need a box to paste it into,
  // its natural and i can see that i did something and also that what i thought i
  // pasted, was really pasted"). The round trip worked entirely invisibly — a
  // keystroke listener and a clipboard watcher — so a paste that missed, or that
  // grabbed the wrong thing, looked exactly like a paste that worked. The box is
  // not a new mechanism; it is the same _pinProcessText the keystroke path uses, with
  // the paste made visible and reversible before it is acted on.
  function _pinLensBannerHtml() {
    var box = 'width:100%;box-sizing:border-box;min-height:4.2rem;margin-top:0.5rem;'
      + 'padding:0.5rem 0.6rem;border:1px solid var(--border);border-radius:8px;'
      + 'background:var(--surface2);color:var(--text);font-family:var(--font-mono);'
      + 'font-size:0.78rem;line-height:1.4;resize:vertical';
    // Theme variables only — the colour ratchet refused a second rgba() literal
    // here and was right to: the banner already carries the one it needs.
    var use = 'padding:0.4rem 0.8rem;border-radius:8px;border:1.5px solid var(--accent2);'
      + 'background:var(--surface2);color:var(--accent2);font-family:var(--font-body);'
      + 'font-weight:700;font-size:0.82rem;cursor:pointer';
    return '<div id="pin-lens-banner" style="background:rgba(212,168,67,0.14);border:1.5px solid var(--accent2,#d4a843);border-radius:9px;padding:0.55rem 0.7rem;margin-bottom:0.6rem;font-size:0.8rem;color:var(--text-mid);line-height:1.45">' +
      '<b>Waiting for Google\u2019s answer.</b> In the Google tab press <b>Ctrl+A</b> then <b>Ctrl+C</b>, ' +
      'come back here and paste it into this box. (A snip works too \u2014 Win+Shift+S, then Ctrl+V anywhere on this card.)' +
      '<textarea id="pin-lens-paste" spellcheck="false" placeholder="Paste Google\u2019s answer here\u2026" ' +
        'oninput="_pinLensPasteChanged()" style="' + box + '"></textarea>' +
      '<div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.45rem;flex-wrap:wrap">' +
        '<button id="pin-lens-use" onclick="_pinUseLensPaste()" disabled style="' + use + ';opacity:0.5">Use this answer</button>' +
        '<span id="pin-lens-count" style="font-size:0.74rem;color:var(--text-dim)">nothing pasted yet</span>' +
      '</div>' +
      '</div>';
  }
  // Live confirmation that something landed, and how much — the whole point of the
  // box is that "what i thought i pasted, was really pasted" is visible.
  window._pinLensPasteChanged = function () {
    var ta = document.getElementById('pin-lens-paste');
    var btn = document.getElementById('pin-lens-use');
    var cnt = document.getElementById('pin-lens-count');
    var n = ta ? String(ta.value || '').trim().length : 0;
    if (btn) { btn.disabled = n < 10; btn.style.opacity = n < 10 ? '0.5' : '1'; }
    if (cnt) {
      cnt.textContent = n
        ? (n.toLocaleString() + ' character' + (n === 1 ? '' : 's') + ' pasted')
        : 'nothing pasted yet';
    }
  };
  window._pinUseLensPaste = function () {
    var ta = document.getElementById('pin-lens-paste');
    var txt = ta ? String(ta.value || '').trim() : '';
    if (txt.length < 10) { showToast('Paste Google\u2019s answer into the box first', 3000, true); return; }
    var _busy = _pinBtnBusy(document.getElementById('pin-lens-use'), 'Reading\u2026');
    try { _pinProcessText(txt); } finally { _busy(); }
  };

  // v0.9.915 (Brad): read a SCREENSHOT of a Google/Lens answer. Pick the
  // screenshot, run it through the same identify AI (it reads the labeled
  // Manufacturer/SKU/Description/Year text right off the image), then apply
  // the result to the group and reopen the review card — same shape as the
  // Lens clipboard return-trip, minus the fiddly text-copy step.
  // v0.9.962 (Brad): ONE place that applies a parsed reading (from a snip, a
  // copied answer, or the Lens return-trip) to the open group and reopens the
  // review card. Returns false if the metadata had nothing usable.
  // v0.9.1086 — `aiText` is a PARAMETER. In v0.9.1085 this function referenced
  // a variable named `ai` that exists in its callers and not here. Every paid
  // read threw a ReferenceError, the try/catch two lines down swallowed it, the
  // previous answer stayed on screen, and the credit was spent. Brad paid twice
  // for that. Syntax checking cannot catch an out-of-scope name; a test that
  // actually CALLS the function can, and there is one now.
  function _pinApplyMeta(meta, gs, aiText) {
    var got = meta && (meta.itemNum || meta.description || meta.manufacturer || meta.roadName);
    if (!got) return false;
    // v0.9.1087 — reconciliation happens HERE, once, for every path that stores
    // a paid read. The v0.9.1084 version was wired by a script that matched the
    // same anchor three times and inserted at the first match every time: all
    // three copies stacked up in the screenshot path (one referencing a variable
    // that does not exist there), and the token button and the batch got NONE.
    // Brad pressed "Read this photo", the reader said 6175 in its own words, and
    // the card kept 6-39457 because nothing on that path ever compared the two.
    // One shared location cannot be wired unevenly.
    try {
      if (typeof _pinReconcileAiNum === 'function') {
        var _rc0 = _pinReconcileAiNum(meta, aiText || '', _pinPreferOf(gs[0]));
        if (_rc0 && _rc0.num && _rc0.num !== meta.itemNum) {
          meta._aiSku = _rc0.swappedFrom || meta.itemNum || '';
          meta.itemNum = _rc0.num;
          // v0.9.1164: a NUMBER confirmed by the catalog is settled. A match on
          // the reader's WORDS overrides a number the reader stated out loud, so
          // it stays a best guess and carries its evidence to the card — a
          // silently swapped number would be worse than no swap at all.
          if (_rc0.viaDesc) {
            meta._hedge = 1;
            meta._viaDesc = _rc0.viaDesc;
            meta._descOf = _rc0.descOf || '';
          } else {
            meta._hedge = 0;            // in-era catalog hit — no longer a guess
          }
        }
      }
    } catch (eR0) { console.warn('[inbox] reconcile failed', eR0 && eR0.message); }
    try {
      var ids = _ids(); var fid0 = _pinOnScreenFid() || _pinReadFid(gs[0]) || gs[0].files[0].id; var prev = ids[fid0] || {};
      var _aiRaw = String(aiText || '').replace(/\s+/g, ' ').trim().slice(0, 900) || (prev.aiRaw || '');
      var _aiSku = (meta && meta._aiSku) || '';
      var trim = function (v, old) { return String(v || old || '').slice(0, 120); };
      ids[fid0] = { aiRaw: _aiRaw, aiSku: _aiSku,
        num: meta.itemNum ? String(meta.itemNum) : (prev.num || ''),
        guess: meta.itemNum ? (meta._hedge ? 1 : 0) : (prev.guess || 0),
        tried: 1,
        // v0.9.1151 (pre-beta audit, BLOCKER 3): PAID reads were stored with no
        // rv stamp. _pinAutoRead skips a photo only when rec.rv === READER_VER,
        // and _stale() calls a missing record stale — so every paid read with no
        // _freeTried marker was re-queued by the background reader (which fires
        // 400ms after each inbox refresh) and REPLACED wholesale by a bare free
        // read. Maker, description, road, year, gauge, subType and aiRaw gone,
        // silently, for money already spent. This file documents the same trap
        // at the re-crop path and fixed it there by stamping rv; the paid writers
        // were missed. Stamping here makes the auto-reader leave paid work alone.
        rv: READER_VER,
        paid: 1,
        mfr: trim(meta.manufacturer, prev.mfr), desc: trim(meta.description, prev.desc),
        road: trim(meta.roadName, prev.road), year: trim(meta.year, prev.year),
        // v0.9.968 (Brad): keep scale + item-type so the Add wizard can pre-fill
        // them (e.g. "O" gauge, "Accessory" for a building). Were being dropped.
        gauge: trim(meta.gauge, prev.gauge), subType: trim(meta.subType, prev.subType),
        // v0.9.1164: when the number came from the reader's WORDS rather than
        // from a number it printed, store the evidence in the same fields the
        // free path uses, so the review card's existing "Matched on the words"
        // disclosure covers the paid read too. One display, both routes.
        viaDesc: !!(meta && meta._viaDesc) || !!prev.viaDesc,
        descOf: (meta && meta._descOf) || prev.descOf || '',
        dbg: (meta && meta._viaDesc)
          ? Object.assign({}, prev.dbg || {}, { viaDesc: meta._viaDesc })
          : (prev.dbg || null)
      };
      _idsSave(ids);
    } catch (eS) {
      // v0.9.1086: this used to log and carry on, so a broken save looked exactly
      // like a good one — which is how a ReferenceError here cost Brad two
      // tokens before anyone noticed. A paid read that cannot be stored says so.
      console.error('[Inbox] could not store the read:', eS);
      showToast(rrSaveError(eS, 'the read \u2014 you were not charged for it again'), 5000, true);
    }
    _render();
    // v0.9.1325: was `_sel = {}; gs.forEach(...)` — staging the groups in the
    // shared selection map so _pinReview(null) would find them. That left them
    // ticked invisibly after the card closed. Named outright now.
    window._pinReview(gs.length === 1 ? gs[0].key : null, gs);
    // v0.9.1092: the re-opened card comes back to the photo that was read,
    // not the first one in the strip.
    try { if (fid0) window._pinRvSetMain(fid0); } catch (eM2) {}
    return true;
  }

  // Read a screenshot/snip blob: free OCR first, then a token read, then apply.
  async function _pinProcessShot(f) {
    var gs = _rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    if (!f) return;
    var btn = document.getElementById('pin-rv-shot');
    var _shotBusy = _pinBtnBusy(btn, 'Reading screenshot\u2026');   // v0.9.1168
    try {
      // v0.9.917 (Brad): CHEAP FIRST. A screenshot is crisp digital text, so
      // try free on-device OCR (Tesseract) before spending a token. Only fall
      // back to the paid read when the free read doesn't yield an item number.
      var meta = null, _freeRead = false;
      try {
        if (typeof window._ensureTesseract === 'function' && typeof extractIdentifyMetadata === 'function') {
          var T = await window._ensureTesseract();
          var ocr = await T.recognize(f, 'eng', {});
          var _otxt = (ocr && ocr.data && ocr.data.text) || '';
          if (_otxt.trim()) {
            var m0 = extractIdentifyMetadata(_otxt);
            if (m0 && m0.itemNum) { meta = m0; _freeRead = true; }   // free read good enough only with a number
          }
        }
      } catch (eOcr) { console.warn('[Inbox] screenshot OCR (free pass) failed:', eOcr && eOcr.message); }
      if (!meta) {
        _shotBusy = _pinBtnBusy(btn, 'Reading\u2026');   // v0.9.1168
        var _h0 = _pinAiHints(_rvGroups && _rvGroups[0]);
        var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2([f], _h0) : await aiIdentifyImage(f, _h0);
        if (!ai || !ai.ok) {
          // v0.9.1163: one shared message source (rrReadFailMessage in ai-id.js).
          // This used to know only 'quota' and 'noconsent', so a switched-off
          // read reported as a failed one.
          var _m0 = (typeof rrReadFailMessage === 'function')
            ? rrReadFailMessage(ai && ai.reason, 'Could not read that screenshot — type the number instead')
            : 'Could not read that screenshot — type the number instead';
          if (_m0) showToast(_m0, 4500, true);
          return;
        }
        if (typeof ai.remaining === 'number') _tokSave(ai.remaining);   // v0.9.969: keep the token count fresh
        meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
      }
      if (!_pinApplyMeta(meta, gs, ai && ai.text)) { showToast('No item info found in that screenshot — type the number instead', 4000, true); return; }
      showToast(meta._hedge
        ? 'Read the screenshot — the number is a best guess, double-check it'
        : ('Read the screenshot' + (_freeRead ? ' (free — no photo ID used)' : '') + ' — check it over and hit Add'), 4000);
    } catch (e) {
      console.warn('[Inbox] read screenshot:', e);
      showToast('Could not read that screenshot — try again or type the number', 3800, true);
    } finally {
      var b2 = document.getElementById('pin-rv-shot');
      if (typeof _shotBusy === 'function') _shotBusy(); else if (b2) { b2.disabled = false; }
    }
  }

  // Read copied TEXT (e.g. Ctrl+A, Ctrl+C of the Google answer) — parse it and
  // apply. No token used; text parsing is free.
  function _pinProcessText(txt) {
    var gs = _rvGroups;
    if (!gs || !gs.length) return false;
    txt = String(txt || '').trim();
    if (!txt) return false;
    var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(txt) : {};
    if (!_pinApplyMeta(meta, gs, txt)) return false;
    showToast(meta._hedge
      ? 'Read the copied answer — the number is a best guess, double-check it'
      : 'Read the copied answer — check it over and hit Add', 4000);
    return true;
  }

  window._pinReadShot = function () {
    var gs = _rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var inp = document.getElementById('pin-shot-input');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'pin-shot-input'; inp.accept = 'image/*'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.value = '';
    inp.onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) _pinProcessShot(f); };
    inp.click();
  };

  // ══ v0.9.1052 — crop before a paid read ══════════════════════════════════
  // Brad photographs a wall, so most frames hold two items — one at the top,
  // one below. The reader answers about whatever it sees, and it took the top
  // one. Cropping does not make the read cheaper; it stops the SECOND read you
  // would otherwise need after the first answered about the wrong train. Over
  // a hundred photos that is a hundred reads instead of two hundred.
  //
  // It is not literally unskippable — a photo that is already tight should not
  // need ceremony. But the skip is a labelled, deliberate choice ("Use whole
  // photo"), not an accidental one, and the crop box opens on the rectangle you
  // used last so most photos need a nudge rather than a fresh drag.
  // v0.9.1309 (Brad: "just get rid of the crop toggle"): the Preferences
  // switch that skipped this step is GONE — the crop offer is unconditional
  // again. It never forces a crop: "Use whole photo" remains the one-tap
  // skip on any photo that is already tight, which is all the escape hatch
  // the step needs. (The stored setting and its reader were removed
  // together — no writer-less orphan key left behind, the v0.9.1130 audit
  // smell this very setting was once fixed FOR.)
  function _pinCropForRead(blob, cb) {
    if (!blob || typeof window._openCropper !== 'function') { cb(blob); return; }
    var url;
    try { url = URL.createObjectURL(blob); } catch (e) { cb(blob); return; }
    var done = false;
    function finish(out) {
      if (done) return; done = true;
      try { URL.revokeObjectURL(url); } catch (e) {}
      cb(out || blob);
    }
    window._openCropper(url,
      function (cropped) { finish(cropped); },
      function () { finish(blob); },
      {
        title: 'Crop to one item',
        hint: 'The reader answers about whatever is in frame',
        applyLabel: 'Read this',
        cancelLabel: 'Use whole photo',
      });
  }

  // v0.9.967 (Brad): identify THIS item straight from its own photo with one
  // token — no Google/Lens round-trip. The free reader already ran on drop, so
  // this goes straight to the paid read for the leftovers it couldn't place.
  window._pinReviewIdentify = async function () {
    var gs = _rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var btn = document.getElementById('pin-rv-idtoken');
    // v0.9.1052: don't say "Reading…" while the crop screen is still open —
    // nothing is being read and nothing has been spent yet.
    var _idBusy = _pinBtnBusy(btn, 'Crop first\u2026');   // v0.9.1168; v0.9.1309: crop step always offered
    try {
      var g = gs[0];
      // v0.9.1092: "Read this photo" reads the photo ON SCREEN. For a set the
      // members are different items, so the extra "angles" are only sent when
      // this is a single-item group — same rule as the batch.
      var _curFid = _pinOnScreenFid();
      var fl;
      if (_pinFilesToRead(g).length > 1) {
        var _cur = g.files.filter(function (f) { return f.id === _curFid; });
        fl = _cur.length ? _cur : g.files.slice(0, 1);
      } else {
        fl = g.files.slice(0, 4);
        if (_curFid) {
          // lead with the photo on screen so it is the one that gets cropped
          fl.sort(function (a, b) { return (a.id === _curFid ? -1 : 0) - (b.id === _curFid ? -1 : 0); });
        }
      }
      var blobs = [];
      for (var i = 0; i < fl.length; i++) {
        try { blobs.push(await _pinBytes(fl[i].id)); } catch (eB) {}
      }
      if (!blobs.length) { showToast('Could not load the photo — try again', 3000, true); return; }
      // v0.9.1052: crop the PRIMARY frame before spending anything. The other
      // angles go as they are — several views genuinely help the read, and
      // cropping four photos one at a time would cost more than it saves.
      blobs[0] = await new Promise(function (res) { _pinCropForRead(blobs[0], res); });
      _idBusy = _pinBtnBusy(btn, 'Reading\u2026');   // v0.9.1168: crop closed, the read is really running now
      _pinStepsReset(); _pinStep(RR_READ_STEPS.paid);   // v0.9.1173
      var _h1 = _pinAiHints(_rvGroups && _rvGroups[0]);
      var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2(blobs, _h1) : await aiIdentifyImage(blobs[0], {});
      if (!ai || !ai.ok) {
        // v0.9.1163 — THE one Brad hit. His reads were switched off, so this
        // said "Could not read that photo — try Google Search" and he went
        // looking for a broken reader. One shared message source now.
        var _m1 = (typeof rrReadFailMessage === 'function')
          ? rrReadFailMessage(ai && ai.reason)
          : 'Could not read that photo — try Google Search, or type the number';
        if (_m1) showToast(_m1, 4500, true);
        return;
      }
      if (typeof ai.remaining === 'number') _tokSave(ai.remaining);   // v0.9.969: keep the token count fresh
      var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
      if (!_pinApplyMeta(meta, gs, ai && ai.text)) { showToast('Could not pull an item number from the photo — try Google Search', 4200, true); return; }
      _pinStepsReset();
      showToast(meta._hedge
        ? 'Best guess from the photo — double-check the number (1 photo ID used)'
        : 'Read from the photo — check it over and add it (1 photo ID used)', 4000);
    } catch (e) {
      console.warn('[Inbox] review identify:', e);
      showToast('Could not read the photo — try again', 3000, true);
    } finally {
      var b2 = document.getElementById('pin-rv-idtoken');
      // v0.9.1168: the restore function puts back exactly what was there, so the
      // v0.9.1163 "reads are off" wording no longer has to be duplicated here.
      if (typeof _idBusy === 'function') _idBusy();
      else if (b2) { b2.disabled = false; }
    }
  };

  // v0.9.962 (Brad): paste-to-read. While the review card is open, press Ctrl+V
  // to read whatever you grabbed from Google — a snipped picture OR copied text
  // (highlight the answer, or just Ctrl+A the whole page). One keystroke, no
  // button, no file picker. A short manual paste into the number box is left
  // alone so typing/pasting a number still works.
  document.addEventListener('paste', function (e) {
    if (!document.getElementById('pin-review-ov')) return;      // only when the review card is open
    if (!_rvGroups || !_rvGroups.length) return;
    var cd = e.clipboardData; if (!cd) return;
    // A picture on the clipboard (a snip) — always read it.
    var items = cd.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        var f = items[i].getAsFile();
        if (f) { e.preventDefault(); showToast('Reading your snip…', 1800); _pinProcessShot(f); return; }
      }
    }
    // Otherwise copied text (the answer). Don't hijack a short paste into a field.
    var txt = (cd.getData && cd.getData('text')) || '';
    txt = txt.trim();
    if (!txt) return;
    var t = e.target;
    // v0.9.1170: a paste aimed at the Lens box belongs IN the Lens box. Without
    // this the listener swallowed it, acted on it invisibly, and left the box
    // empty — which is precisely the "did that even work?" the box exists to end.
    if (t && t.id === 'pin-lens-paste') { setTimeout(window._pinLensPasteChanged, 0); return; }
    var inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if (inField && txt.length < 25) return;   // let a short manual paste land in the box
    e.preventDefault();
    showToast('Reading the copied answer…', 1800);
    _pinProcessText(txt);
  });

  // Return-trip watcher for Research by Photo (mirrors the wizard's
  // _identifyReadClipboard flow): on tab-return, read the clipboard, parse
  // Google's copied answer, merge it into the group's stored findings, and
  // reopen the review card. Watches for 15 minutes, ignores an unchanged
  // clipboard, and gives up silently on clipboard-permission denials.
  var _pinLensGroups = null, _pinLensClip = '', _pinLensVisOn = false, _pinLensArmedAt = 0;
  function _pinLensArm(gs) {
    _pinLensGroups = gs;
    _pinLensArmedAt = new Date().getTime();
    _pinLensClip = '';
    try { navigator.clipboard.readText().then(function (t) { _pinLensClip = (t || '').trim(); }).catch(function () {}); } catch (e) {}
    if (!_pinLensVisOn) {
      _pinLensVisOn = true;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && _pinLensGroups) setTimeout(_pinLensCheck, 450);
      });
    }
  }
  function _pinLensCheck() {
    if (!_pinLensGroups) return;
    if (new Date().getTime() - _pinLensArmedAt > 15 * 60 * 1000) { _pinLensGroups = null; return; }
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    navigator.clipboard.readText().then(function (txt) {
      txt = (txt || '').trim();
      if (!txt || txt === _pinLensClip) return;   // nothing new copied yet — keep watching
      _pinLensClip = txt;
      var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(txt) : {};
      var got = meta.itemNum || meta.description || meta.manufacturer || meta.roadName;
      if (!got) return;                            // unrelated clipboard — keep watching
      var gs = _pinLensGroups;
      _pinLensGroups = null;
      // v0.9.962: same shared applier as the snip/paste paths.
      // v0.9.1124 (audit finding): this passed `ai && ai.text` — but `ai` is a
      // local in the three OTHER callers and does not exist here, so every
      // successful return trip threw ReferenceError. `_pinLensGroups = null`
      // two lines up had already disarmed the watcher, and the .catch() below
      // (written for clipboard-permission denials) ate the error, so the whole
      // Google round trip failed silently and could not be retried. The text
      // the applier wants is the clipboard text itself — same as line 2252.
      if (_pinApplyMeta(meta, gs, txt)) {
        showToast(meta._hedge
          ? "Google's answer applied, but it hedged on the number — double-check it"
          : "Google's answer applied — check it over and hit Add", 4000);
      }
    }).catch(function () { /* permission denied — the number box still takes a manual paste */ });
  }

  window._pinReviewResearch = function () {
    var num = (document.getElementById('pin-rv-num') || {}).value || '';
    num = String(num).trim();
    if (!num) { showToast('Type an item number to research', 2500, true); return; }
    // v0.9.970 (Brad): remember this item's group(s) so Close on the Research
    // Result card brings you back to THIS item's card, not the inbox grid.
    var _keys = (_rvGroups || []).map(function (g) { return g.key; });
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    if (typeof window._researchLookupTyped === 'function') {
      window._researchLookupTyped(num, { onClose: function () {
        if (!_keys.length) return;
        // v0.9.1325: re-resolve the keys against the LIVE groups rather than
        // staging them in _sel (see _pinReview's `only` note). Re-resolving
        // also means a group that left the inbox while Research was open
        // simply drops out instead of re-opening a card on a dead key.
        var _back = _groups.filter(function (g) { return _keys.indexOf(g.key) >= 0; });
        if (!_back.length) return;
        try { window._pinReview(_back.length === 1 ? _back[0].key : null, _back); } catch (e) {}
      } });
    } else showToast('Research is still loading — try again in a moment', 3000, true);
  };

  // v0.9.1325 — THE INVISIBLE SELECTION BUG.
  //
  // This used to stage _rvGroups into the shared `_sel` map and call
  // _pinDiscard() with no argument. If the user then pressed Cancel at the
  // confirm, _pinDiscard returned without clearing _sel and without a
  // re-render — so the photos stayed SELECTED with no tick drawn anywhere
  // (the tick circle is built only in select mode, photo-inbox.js:_render),
  // while _selInfo armed both Discard and Identify on the count alone.
  //
  // The user's next tap on Identify then spent one photo ID per hidden photo,
  // and Discard binned photos they could not see were chosen. Same leak via
  // _pinApplyMeta (after a paid read) and via Research's onClose.
  //
  // Fixed at the root — the groups are passed as an argument — and belt and
  // braces in _selInfo, which now refuses to arm those two buttons outside
  // select mode no matter what is in _sel.
  window._pinReviewDiscard = function () {
    var gs = _rvGroups;
    if (!gs.length) return;
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _pinDiscard(gs);
  };

  // Shared filing core: move every photo in `gs` into the item's Drive
  // folder, connect the sheet's photo link when the item is owned, or
  // remember the link + open the Add wizard when it isn't.
  window._pinReviewAdd = async function (mode) {
    mode = mode || 'auto';
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    if (!num) { showToast('Type or confirm the item number first', 2500, true); return; }
    var gs = _rvGroups;
    // v0.9.1418: same silent guard as Apply had. Filing to the collection is
    // the single most consequential button on this page to press twice and
    // hear nothing from.
    if (_busy) { _pinBusyBounce(); return; }
    if (!gs.length) return;
    // Ownership decides File-vs-Attach, so check it before we commit anything.
    var lkPre = _pinLookup(num);
    if (mode === 'attach' && !lkPre.ownedPd) {
      showToast('You don’t own ' + num + ' yet — use “File to my Collection” to add it, or type a number you already own', 5000, true);
      return;
    }
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _setBusy(true, 'Filing to your collection');
    try {
      var fromFid = await _folder();
      var toFid = await driveEnsureItemFolder(num);
      var link = driveFolderLink(toFid);
      var lk = lkPre;
      // Attach path when the user asked to attach, or when it's an owned item
      // being auto-filed / listed for sale. 'new' always makes a fresh item.
      // v0.9.966 (Brad): only the (now-unused) explicit 'attach' mode attaches.
      // 'new' and 'forsale' ALWAYS create a new item — multiples are allowed, so
      // we never silently fold photos into an item you already own.
      var _attach = (mode === 'attach');
      // Gather every selected file once (used whether we move now or on save).
      var fileList = [];
      for (var g = 0; g < gs.length; g++) {
        for (var f = 0; f < gs[g].files.length; f++) { fileList.push(gs[g].files[f]); }
      }
      var ts = new Date().getTime();
      if (_attach) {
        // Already in the collection: committed action, no wizard to cancel,
        // so file the photos into its folder right away.
        // v0.9.1275 (R15): `moved` used to count files it was ABOUT to move,
        // and one failure abandoned the rest and skipped the toast entirely.
        // Now each move gets its own try, the count is of moves that landed,
        // and the toast below reports the real number either way.
        var moved = 0, _mvFail = 0;
        for (var i2 = 0; i2 < fileList.length; i2++) {
          _status('Filing photo ' + (i2 + 1) + ' of ' + fileList.length + '…');
          var file = fileList[i2];
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
          try {
            await driveMoveFileToFolder(file.id, fromFid, toFid);
            moved++;
          } catch (eMv1) {
            _mvFail++;
            console.warn('[Inbox] attach move failed — continuing:', file.id, eMv1);
            continue;
          }
          try { await driveRequest('PATCH', '/files/' + file.id, { name: num + ' ADD ' + (ts + moved) + '.' + ext }); } catch (eRn) {}
        }
        _sel = {};
        _status('');
        var pd = lk.ownedPd;
        // v0.9.1252 (row-identity audit, finding 16): pd was captured before a
        // folder lookup and a per-file Drive move/rename loop — a long way back.
        // Its .row can be stale by now, and the sibling write in _flushPending
        // was hardened for exactly this in v0.9.1192 while this one was not.
        // Match it: re-resolve the live record, refuse a placeholder row, and
        // only record the link in memory once the sheet has actually taken it.
        var _pdKey = Object.keys(state.personalData || {}).find(function (k) { return state.personalData[k] === pd; });
        var _livePd = (_pdKey && state.personalData[_pdKey]) || pd;
        var _rowKnown = _livePd.row && Number(_livePd.row) !== 99999;
        if (!_livePd.photoItem && link && _rowKnown
            && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && window.state.personalSheetId) {
          try {
            if (await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, _livePd.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + _livePd.row, [[link]], { num: _livePd.itemNum || '', invId: _livePd.inventoryId || '' }, 'collection'))
              _livePd.photoItem = link;   // only true once the sheet actually took it
          } catch (eUp) { console.warn('[Inbox] photo link write failed — leaving it for the repair pass:', eUp); }
        }
        if (_mvFail) showToast('Attached ' + moved + ' of ' + fileList.length + ' photo' + (fileList.length > 1 ? 's' : '') + ' to ' + num + ' \u2014 ' + _mvFail + ' stayed in the inbox. Try them again.', 5000, true);
        else showToast('Attached ' + moved + ' photo' + (moved > 1 ? 's' : '') + ' to ' + num, 3000);
        _pinRefresh();
        // v0.9.958 (Brad): "Send to For Sale" on an item you already own —
        // photos are filed above, now open the sale-price step for it.
        if (mode === 'forsale') {
          var _pdKey = Object.keys(state.personalData || {}).filter(function (k) { return state.personalData[k] === lk.ownedPd; })[0];
          if (_pdKey && typeof listForSaleFromCollection === 'function') { listForSaleFromCollection(-1, _pdKey); }
          else showToast('Photos attached — open ' + num + ' from My Collection to set a sale price', 4500);
        }
      } else {
        // NOT in the collection yet: the Add wizard opens next and may be
        // cancelled. DEFER moving the photos out of the inbox until the item
        // is actually saved (see _flushPending). Cancel = nothing moved and
        // the photos stay in the inbox. (Session 168, Brad — fixes vanishing photos)
        _sel = {};
        _status('');
        // v0.9.1130 (audit #4) — this note used to go STRAIGHT into PENDING_KEY,
        // and _flushPending files a note the moment ANY owned row with that
        // number exists. Adding a second copy of something you already own made
        // that true instantly, so cancelling the wizard could not stop the
        // photos leaving the inbox. Exactly the bug v0.9.1122 fixed for sets;
        // the single-item lane never got the same treatment. It stages now and
        // is armed by rrPinSetPhotoSaved when a save really happens.
        try {
          var stage1 = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
          stage1[num] = { link: link, fromFid: fromFid, toFid: toFid, ts: ts,
            rsvFid: (fileList[0] && fileList[0].id) || '',   // v0.9.935: files as the Right Side View
            files: fileList.map(function (fl) { return { id: fl.id, name: fl.name }; }) };
          localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage1));
        } catch (eP) {}
        _pinRefresh();
        showToast(fileList.length + ' photo' + (fileList.length > 1 ? 's' : '') + ' will attach when you save — they stay in the inbox until then', 3500);
        var _aiS = {}; try { _aiS = _ids()[gs[0].files[0].id] || {}; } catch (eAi) {}
        // v0.9.907 (Brad, item [1a]): hand the first inbox photo's Drive id to the
        // wizard so the variation step can preview the item you're adding.
        var _addPhotoId = (fileList[0] && fileList[0].id) || '';
        // v0.9.1369 (Brad): the WHOLE group rides along, not just the first
        // shot. A two-photo group is usually one picture of the piece and one
        // of the number stamped on it — handing over only the first is handing
        // over the half that cannot identify anything.
        var _addPhotoIds = fileList.map(function (fl) { return (fl && fl.id) || ''; }).filter(Boolean);
        _pinAddNow(num, { manufacturer: _aiS.mfr || '', description: _aiS.desc || '', roadName: _aiS.road || '', year: _aiS.year || '', gauge: _aiS.gauge || '', subType: _aiS.subType || '', _prefer: _pinPreferOf(gs[0]) }, _addPhotoId, { alsoListForSale: mode === 'forsale', photoIds: _addPhotoIds, groupKind: (gs[0] && (gs[0].kind || (gs[0].files[0] && gs[0].files[0]._meta && gs[0].files[0]._meta.kind))) || '' });
        if (mode === 'forsale') showToast('Adding ' + num + ' to your collection and For Sale list — set the price on the sale step', 4500);
      }
    } catch (e) {
      console.error('[Inbox] add/attach:', e);
      _status('Filing failed partway — hit Refresh to see what’s left, then try again.');
    } finally { _setBusy(false); }
  };

  // v0.9.958 (Brad): the four review-card exits are thin wrappers over the one
  // shared filer, so every path uses the exact same, tested Drive/sheet code.
  // v0.9.966 (Brad): "Add to my Collection" ALWAYS adds a new item — you can
  // own multiples of the same number, so it must never fold photos into an
  // existing item. (Adding photos to an item you already own is a separate flow.)
  // v0.9.1114 — the photo group walks into the wizard's EXISTING set flow
  // with its members pre-entered. The identify step's suggestion engine
  // (suggestSets) runs off _enteredNums on render, so with six member reads
  // the right set usually appears immediately with a "This is mine" button.
  // ══ v0.9.1296 (request #24): photos → set members, as ONE pure walk. ═════
  // Files are walked in display order. A 'together' shot belongs to nobody.
  // A 'detail' shot belongs to the PIECE ABOVE it — it contributes its
  // photos, never its own number, so a car with a close-up is one member
  // with two pictures instead of two members. A detail whose piece above
  // never produced a number stays in the inbox with that piece (attaching it
  // to the member before THAT would file it on the wrong car).
  function _pinSetMemberMap(files, ids0) {
    var nums = [], memberPhotos = {}, numFiles = {};
    var lastNum = '', lastFailed = false;
    // v0.9.1343 — pair shots ride with the set's ENGINE, wherever they sit.
    // Brad's call over "the piece below it": a shot of an engine+tender, an AA
    // or an ABA is always of the locomotive consist, so tying it to the engine
    // means he never has to think about photo order for these. That needs the
    // members resolved first, so pair shots are set aside here and attached in
    // a second pass below.
    var pairPhotos = [], engineNum = '';
    (files || []).forEach(function (f) {
      var meta = (f && f._meta) || {};
      if (meta.role === 'together') return;
      if (_pinIsPairRole(meta.role)) { pairPhotos.push(f); return; }
      if (meta.role === 'detail') {
        if (lastNum && !lastFailed) {
          (memberPhotos[lastNum] = memberPhotos[lastNum] || []).push(f.id);
          (numFiles[lastNum] = numFiles[lastNum] || []).push({ id: f.id, name: f.name });
        }
        return;
      }
      var s0 = f && ids0[f.id];
      var n0 = (s0 && s0.num) ? String(s0.num).trim() : '';
      if (!n0) { lastFailed = true; return; }
      lastFailed = false; lastNum = n0;
      // The first photo tagged Engine names the engine. Nothing tagged Engine
      // (he may not have bothered) → the set's lead item, which is the one the
      // set flow already treats as the locomotive.
      if (!engineNum && meta.role === 'engine') engineNum = n0;
      if (nums.indexOf(n0) < 0) nums.push(n0);
      // v0.9.1117 (Brad: "its not putting the pictures in their rhs slot") —
      // each member's own inbox photo rides into that item's photo slot.
      // v0.9.1122: a LIST per number, not one id — a set that contains the
      // same car twice (1562W's two 2442s) hands slot 1 the first photo and
      // slot 2 the second, instead of both showing the same picture.
      (memberPhotos[n0] = memberPhotos[n0] || []).push(f.id);
      // v0.9.1118: every photo that read this member's number files with it.
      (numFiles[n0] = numFiles[n0] || []).push({ id: f.id, name: f.name });
    });
    // Second pass: file every pair shot with the engine. If the set produced no
    // members at all there is nothing to attach to, and the photo simply stays
    // in the inbox rather than being silently dropped.
    var homeNum = engineNum || nums[0] || '';
    if (homeNum) {
      pairPhotos.forEach(function (f) {
        (memberPhotos[homeNum] = memberPhotos[homeNum] || []).push(f.id);
        (numFiles[homeNum] = numFiles[homeNum] || []).push({ id: f.id, name: f.name });
      });
    }
    return { nums: nums, memberPhotos: memberPhotos, numFiles: numFiles, pairHome: homeNum, pairCount: pairPhotos.length };
  }
  if (typeof window !== 'undefined') window._pinSetMemberMap = _pinSetMemberMap;

  window._pinAddSetFromGroup = function () {
    var g = _rvGroups && _rvGroups[0];
    if (!g) return;
    var ids0 = _ids();
    // The walk sees the FULL ordered file list (not _pinFilesToRead, which
    // strips the detail shots this walk exists to attach).
    var _mm = _pinSetMemberMap(g.files, ids0);
    var nums = _mm.nums, memberPhotos = _mm.memberPhotos, numFiles = _mm.numFiles;
    if (nums.length < 2) { showToast('Fewer than two member numbers are read \u2014 re-read or type them first', 3500, true); return; }
    if (typeof _buildWizardModal !== 'function' || typeof getSteps !== 'function' || typeof renderWizardStep !== 'function') {
      showToast('The add wizard is not available on this page', 3000, true); return;
    }
    // v0.9.1118 (Brad: "the set was added, but the picture group did not
    // disappear") — one note per member, so the SAME machinery that clears a
    // single add clears the whole group once the walkthrough saves. No Drive
    // calls here; _flushPending resolves the folders at move time.
    //
    // v0.9.1122 (Brad: "i hit discard … the set picture was there but no item
    // pictures"): these notes used to go straight into PENDING_KEY, and
    // _flushPending files a note the moment an owned row with that number
    // exists. For a set Brad had ALREADY added once, that was true instantly —
    // so the photos filed themselves before he finished, and cancelling could
    // not put them back. Notes now wait in a STAGING area and are armed one at
    // a time, only when that member actually saves (rrPinSetPhotoSaved, called
    // from the set-save hook). Cancel now genuinely leaves the photos alone.
    // A new set add supersedes any abandoned staging. Photos whose number
    // never read are left in the inbox on purpose.
    try {
      var stage0 = {}, ts0 = new Date().getTime();
      nums.forEach(function (n1) {
        var fl = numFiles[n1] || [];
        if (!fl.length) return;
        stage0[n1] = { link: '', fromFid: '', toFid: '', ts: ts0,
                       rsvFid: fl[0].id, files: fl };
      });
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage0));
    } catch (eP0) {}
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _buildWizardModal();
    // v0.9.1115 (Brad: "it asks me the priority for this item, which is a
    // want list item"): `wizard` is a top-level `let` — it does NOT live on
    // window. Assigning window.wizard made a decoy while renderWizardStep
    // kept reading the real, script-scoped variable, which still held the
    // LAST wizard used — Brad's previous Want-list add, priority question
    // and all. Bare assignment reaches the real binding, exactly like
    // addSetToCollection does.
    wizard = {
      step: 0, tab: 'set',
      data: { tab: 'set', set_knowsNum: 'No', _enteredNums: nums.slice(0),
              _setMemberPhotos: memberPhotos, _returnPage: 'photo-inbox' },
      steps: [], matchedItem: null,
    };
    wizard.steps = getSteps('set');
    var _skip = { set_knowsNum: 1, set_num: 1, set_loco: 1 };
    while (wizard.step < wizard.steps.length && _skip[wizard.steps[wizard.step].id]) wizard.step++;
    document.getElementById('wizard-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    renderWizardStep();
  };

  window._pinFileToCollection = function () { return window._pinReviewAdd('new'); };
  window._pinAttachOwned      = function () { return window._pinReviewAdd('attach'); };
  window._pinSendForSale      = function () { return window._pinReviewAdd('forsale'); };

  // ══ v0.9.1387 — SOME THINGS DO NOT HAVE AN ITEM NUMBER ════════════════════
  //
  // Brad, on a photo of a Lionel engineering blueprint: "it forces you to
  // enter an item number for something that doesn't have one. this paper item
  // should be manually entered."
  //
  // Every exit from the review card ran through _pinReviewAdd, which opens
  // with `if (!num) ... return`. The card assumed the thing in the photo is a
  // catalogued train. A blueprint, a poster, a catalogue, a mock-up has no
  // catalogue number — and worse, the reader had FOUND numbers on his drawing
  // (2205, 1872-21, 272723) and offered 2205 as a catalogue match, so the card
  // looked confident about an item number the object does not have.
  //
  // The wizard has handled these since v0.9.1278: the Item Type selector at
  // the top of the first screen offers Paper Item, Catalog, Mock-Up, Other and
  // Manual, and an ephemera save generates its own number. The only thing
  // missing was a door into it that did not demand a number first.
  //
  // NOTHING is guessed here. Brad picks the type from that selector — his
  // call, screenshotted: "should be the picker i just uploaded".
  var NONUM_PREFIX = '__nonum__';
  window._pinAddNoNumber = function () {
    var gs = _rvGroups;
    // v0.9.1418: the third silent guard.
    if (_busy) { _pinBusyBounce(); return; }
    if (!gs.length) return;
    if (typeof openWizard !== 'function') { showToast('Add wizard not available', 2500, true); return; }
    var fileList = [];
    for (var g = 0; g < gs.length; g++)
      for (var f = 0; f < gs[g].files.length; f++) fileList.push(gs[g].files[f]);
    if (!fileList.length) return;

    // Stage with NO Drive work, exactly as the set lane does (v0.9.1122):
    // empty fromFid/toFid/link are resolved by _flushPending at save time.
    // That matters more here than anywhere else — the folder must be named
    // after the number the ephemera save GENERATES, which does not exist yet,
    // and a cancelled add must leave no empty folder behind in Drive.
    var key = NONUM_PREFIX + new Date().getTime();
    try {
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      // v0.9.1390 — SWEEP ANY ABANDONED SCRATCH NOTE FIRST.
      //
      // Caught walking a real two-photo group: cancelling cleared the note the
      // wizard was tracking and left an EARLIER one behind, holding both photo
      // ids forever. _doCloseWizard can only drop the key it was handed, so a
      // second press of this button (a double-tap, a re-render, a mis-click)
      // orphans the first note with nothing left pointing at it.
      //
      // Only one numberless add can be in flight at a time, so any scratch key
      // sitting here now is by definition abandoned. Harmless to the photos —
      // they never left the inbox — but the crumbs pile up invisibly and each
      // one keeps a stale list of Drive ids.
      Object.keys(stage).forEach(function (k0) {
        if (k0.indexOf(NONUM_PREFIX) === 0) delete stage[k0];
      });
      stage[key] = { link: '', fromFid: '', toFid: '', ts: new Date().getTime(),
                     rsvFid: (fileList[0] && fileList[0].id) || '',
                     files: fileList.map(function (fl) { return { id: fl.id, name: fl.name }; }) };
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (eS) { console.warn('[Inbox] could not stage the numberless add', eS && eS.message); }

    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _sel = {};
    openWizard('collection');
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = (typeof wizard !== 'undefined') && wizard && wizard.steps && wizard.data
                  && document.getElementById('wizard-modal');
      if (ready) {
        clearInterval(t);
        try {
          // _fromInbox is what puts the Item Type selector on screen.
          // _pinStagedNum is re-keyed to the generated number by the ephemera
          // save (wizard-save.js) and survives a type change (_wizSetKind).
          // itemNum is deliberately NOT set: there is no number, and writing
          // the staging key into it would put "__nonum__…" on the sheet.
          wizard.data._fromInbox = true;
          wizard.data._pinStagedNum = key;
          wizard.data._noNumberEntry = true;
          wizard.data._returnPage = 'photo-inbox';
          var _hero = (fileList[0] && fileList[0].id) || '';
          if (_hero) wizard.data._addPhotoDriveId = _hero;
          var _all = fileList.map(function (fl) { return (fl && fl.id) || ''; }).filter(Boolean);
          if (_all.length) wizard.data._addPhotoDriveIds = _all;
          if (typeof renderWizardStep === 'function') renderWizardStep();
          showToast('Pick what it is from Item Type at the top — paper, catalog, mock-up or other. '
            + fileList.length + ' photo' + (fileList.length > 1 ? 's' : '')
            + ' will attach when you save.', 5500);
        } catch (eW) { console.error('[Inbox] numberless add:', eW); }
      }
      if (tries > 60) clearInterval(t);
    }, 100);
  };

  // A numberless add that is CANCELLED must not leave its staging note behind.
  // A note keyed by a real item number is harmless — it arms itself if that
  // number is ever added. A "__nonum__…" key can never match anything, so
  // without this it would sit in localStorage forever holding photos that stay
  // in the inbox looking untouched. Called from _doCloseWizard on cancel.
  window.rrPinDropStaged = function (key) {
    try {
      var k = String(key || '');
      if (k.indexOf(NONUM_PREFIX) !== 0) return;    // only ever our own scratch keys
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      if (!(k in stage)) return;
      delete stage[k];
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (e) { console.warn('[Inbox] could not drop the staged note', e && e.message); }
  };

  window._pinAddNow = function (num, aiMeta, photoDriveId, opts) {
    if (typeof openWizard !== 'function') { showToast('Add wizard not available', 2500, true); return; }
    openWizard('collection');
    // v0.9.889 (Brad): pre-fill the ENTIRE catalog side of the add, the same
    // way a successful barcode scan does — lock the matched catalog item,
    // adopt its era, and jump past the item-number step. Only the personal
    // questions (condition, price, photos) remain for the user.
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = (typeof wizard !== 'undefined') && wizard && wizard.steps && wizard.data && document.getElementById('wizard-modal');
      if (ready) {
        clearInterval(t);
        try {
          wizard.data.itemNum = num;
          // v0.9.1278 (Brad's framed Southern poster): an add that starts in
          // the inbox is not always a train. These two flags are what let the
          // Item Type selector appear and the staged photos follow the entry
          // whatever kind it turns out to be.
          wizard.data._fromInbox = true;
          wizard.data._pinStagedNum = num;
          // v0.9.958 (Brad): "Send to For Sale" on a not-yet-owned item — flag
          // the add so it lands in My Collection AND on the For Sale list.
          if (opts && opts.alsoListForSale) { wizard.data._alsoListForSale = true; wizard.data._returnPage = wizard.data._returnPage || 'forsale'; }
          // v0.9.1062 (Brad): "when you hit add an item and then hit cancel, it
          // kicks you back to the dashboard and not back to the photo inbox."
          // openWizard infers where to return from window._rrLastPage, which is
          // whatever page was last shown — and the review card is a MODAL over
          // the inbox, so whether that inference lands on 'photo-inbox' depends
          // on how the user got here. Inference is the wrong tool when the
          // answer is known: an add started from the inbox returns to the
          // inbox, stated outright. (For Sale keeps its own destination.)
          else wizard.data._returnPage = 'photo-inbox';
          // v0.9.907 (Brad, item [1a]): stash the inbox photo's Drive id so the
          // variation step can preview it (loaded via loadDriveThumb).
          if (photoDriveId) wizard.data._addPhotoDriveId = photoDriveId;
          // v0.9.1369 — and the rest of the group's photos, in the order they
          // were shot, so the viewer can flip between them. The hero above
          // stays whatever it was; this list only ever ADDS what to look at.
          try {
            var _pl = (opts && opts.photoIds) || [];
            if (!_pl.length && photoDriveId) _pl = [photoDriveId];
            if (_pl.length) wizard.data._addPhotoDriveIds = _pl;
          } catch (ePl) {}
          // v0.9.1279 (Brad): a group marked "Paper / other collectible" skips
          // the train prefill entirely — the add opens in the paper flow, where
          // the Item Type selector still allows Catalog / Mock-Up / Other. The
          // flags above ride along (wizardChooseCategory keeps wizard.data), so
          // the staged photos attach on save exactly as v0.9.1278 arranged.
          if (opts && opts.groupKind === 'paper' && typeof wizardChooseCategory === 'function') {
            wizardChooseCategory('paper');
            showToast('Starting a paper/other item — the photos will attach when you save', 3000);
            return;
          }
          var m = _pinBestMaster(num, (aiMeta && aiMeta.manufacturer) || '', (aiMeta && aiMeta._prefer) || null);
          // v0.9.1371 — remember WHY there is no match. A brand disagreement
          // (v0.9.941, Marx 1303 vs Atlas 1303) is a deliberate "make a manual
          // entry for the real brand" and must keep working; only a genuinely
          // EMPTY catalogue lookup earns the dashed-relative widening below.
          var _mfrSuppressed = false;
          if (m && aiMeta && aiMeta.manufacturer) {
            var _mMk = m.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era].manufacturer : '');
            // v0.9.941: photo says one brand, number matches another -> treat as
            // no catalog match so the wizard makes a manual entry for the REAL
            // brand instead of silently adopting the wrong item (Marx 1303 vs
            // Atlas 1303).
            if (!_pinMfrAgree(aiMeta.manufacturer, _mMk)) { m = null; _mfrSuppressed = true; }
          }
          if (m) {
            wizard.matchedItem = m;
            if (m._era) wizard.data._era = m._era;
            // v0.9.1341: carry the inbox's own answer into the wizard. AFTER
            // the match, because a grouping resolves the B unit and the dummy
            // from the item number and the catalog. Through the SAME resolver
            // the grouping buttons use (rrApplyGroupingChoice) — reproducing
            // its fields here would have missed the engine-row lock, which is
            // the number-only first-find shape all over again.
            //
            // Deliberately does NOT advance past the grouping step. The tag
            // could be wrong, and a pre-filled answer he can see and change
            // beats a silent one he cannot.
            var _pg = _pinGroupingFor(opts && opts.groupKind);
            if (_pg && typeof rrApplyGroupingChoice === 'function') {
              try {
                if (rrApplyGroupingChoice(_pg)) {
                  wizard.data._pinGroupingFromInbox = _pg;
                  if (typeof getSteps === 'function' && wizard.tab) wizard.steps = getSteps(wizard.tab);
                }
              } catch (ePg) { console.warn('[Inbox] grouping prefill:', ePg); }
            }
            wizard.step++;              // same advance a barcode scan does
            renderWizardStep();
            showToast(_pg
              ? '\u2713 ' + num + ' \u2014 catalog details filled in, and it is already set up as ' + _pinKindLabel(opts.groupKind)
              : '\u2713 ' + num + ' \u2014 catalog details filled in', _pg ? 4000 : 2500);
          } else if (!_mfrSuppressed && _pinDashedKin(num).length) {
            // v0.9.1371 — the catalogue DOES know this number, as a family of
            // dashed relatives. Saying "isn't in the catalog" here was simply
            // false, and it threw away fourteen real rows. Hand it to the
            // wizard the way typing the number by hand does: the item-number
            // step's partial matching already offers every relative, and Brad
            // picks the one he is holding. No guessing on his behalf.
            var _kin = _pinDashedKin(num);
            var _inpK = document.getElementById('wiz-input');
            if (_inpK) _inpK.value = num;
            try { if (typeof debouncedItemSuggestions === 'function') debouncedItemSuggestions(num); } catch (eK) {}
            var _shown = _kin.slice(0, 3).join(', ');
            showToast('There is no plain ' + num + ' — it is catalogued as ' + _shown
              + (_kin.length > 3 ? ' and ' + (_kin.length - 3) + ' more' : '')
              + '. Pick the one you have.', 6000);
          } else if (typeof _identifyRouteToManualEntry === 'function' && _identifyRouteToManualEntry(num, aiMeta || {}, [])) {
            showToast(num + " isn't in the catalog — details from the photo are filled in", 3000);
          } else {
            // Last resort: behave like typing the number by hand.
            var inp = document.getElementById('wiz-input');
            if (inp) inp.value = num;
            try { if (typeof debouncedItemSuggestions === 'function') debouncedItemSuggestions(num); } catch (e) {}
          }
        } catch (e) { console.warn('[Inbox] wizard prefill:', e); }
      }
      if (tries > 20) clearInterval(t);
    }, 250);
  };

  // v0.9.1122 — arm ONE staged set-photo note. Called from the set-save hook
  // the instant a member is really written to the sheet, so the photo move is
  // driven by a save that happened, never by a save that merely might.
  // v0.9.1278: an inbox add can finish as a PAPER ITEM (or catalog, mock-up,
  // other). Those save under a GENERATED number, not the one typed on the
  // review card — so the staged photo note, keyed by the typed number, would
  // be stranded forever. The save re-keys it to the number the row actually
  // carries, then arms it, and the photos file exactly like a train add's.
  window.rrPinRekeyStaged = function (oldNum, newNum) {
    try {
      var o = String(oldNum || '').trim(), n = String(newNum || '').trim();
      if (!o || !n || o === n) return;
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      var key = Object.keys(stage).find(function (k) {
        return k === o || (typeof normalizeItemNum === 'function' &&
                           normalizeItemNum(k) === normalizeItemNum(o));
      });
      if (!key) return;
      if (!stage[n]) stage[n] = stage[key];   // never clobber another note
      delete stage[key];
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (e) { console.warn('[Inbox] could not re-key the staged photo note', e && e.message); }
  };

  // v0.9.1370 — ONE reader for "what is queued under this number?". Three
  // shapes have existed: a plain link string (pre-1118), a single note object,
  // and now a list of note objects. Every caller comes through here so the
  // shape is decided in one place rather than sniffed at each use.
  function _pendList(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v.filter(function (x) { return x != null; }) : [v];
  }
  if (typeof window !== 'undefined') window._pendList = _pendList;

  window.rrPinSetPhotoSaved = function (itemNum) {
    try {
      var n = String(itemNum || '').trim();
      if (!n) return;
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      var key = Object.keys(stage).find(function (k) {
        return k === n || (typeof normalizeItemNum === 'function' &&
                           normalizeItemNum(k) === normalizeItemNum(n));
      });
      if (!key) return;                                  // nothing staged for this member
      var pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
      // ── v0.9.1370 (Brad's two 3362s) ──────────────────────────────────
      // This used to read `if (!pend[n]) pend[n] = stage[key];` — one note
      // per item NUMBER, and it REFUSED to file a second one. Then it deleted
      // the staged copy regardless, so the second copy's photos were dropped
      // on the floor: nothing anywhere would ever move them, and they sat in
      // the inbox looking like they had been ignored. Brad added two 3362s
      // and the second one's photos never left.
      //
      // You can own several of the same number — the app has said so since
      // v0.9.966 — so a queue keyed by number was always going to lose one.
      // It is a LIST now, one note per copy, filed in the order they were
      // saved. Old entries (a bare object, or a plain link string from before
      // v0.9.1118) are read as a one-item list, so nothing already queued on
      // anyone's machine is lost.
      pend[n] = _pendList(pend[n]).concat([stage[key]]);
      delete stage[key];                                 // armed once — a repeat car reuses the same folder
      localStorage.setItem(PENDING_KEY, JSON.stringify(pend));
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (e) { console.warn('[Inbox] could not arm the set photo note', e && e.message); }
  };

  // When an item is actually saved, file any pending inbox photos into its
  // Drive folder and connect the photo link. Runs on every dashboard build but
  // only acts on items that now exist in the collection, so a cancelled add
  // leaves its photos untouched in the inbox. (Session 168, Brad)
  var _flushingNums = {};
  async function _flushPending() {
    var pend;
    try { pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); } catch (e) { pend = {}; }
    var nums = Object.keys(pend);
    if (!nums.length || !window.state || !state.personalData) return;
    for (var ni = 0; ni < nums.length; ni++) {
      var num = nums[ni];
      if (_flushingNums[num]) continue;
      // v0.9.1118: set members save under the MASTER row's item number, which
      // can differ from the read's formatting (2343P vs 2343-P) — match through
      // the same normalizer the walkthrough uses, so a note can't be stranded.
      // v0.9.1130 (audit #4, second half): this took the FIRST owned row with a
      // matching number, which contradicts the design note above — you can own
      // several of the same number, so a new copy's photos could be filed onto
      // an older copy. Prefer the copy with no photo link yet (the one just
      // added), and among those the highest inventory id.
      var _cands = Object.values(state.personalData).filter(function (p) {
        if (!p || !p.owned || !p.itemNum) return false;
        if (String(p.itemNum) === num) return true;
        return (typeof normalizeItemNum === 'function') &&
               normalizeItemNum(String(p.itemNum)) === normalizeItemNum(num);
      });
      var _fresh = _cands.filter(function (p) { return !p.photoItem; });
      var _pick = (_fresh.length ? _fresh : _cands).sort(function (a, b) {
        return (parseInt(b.inventoryId) || 0) - (parseInt(a.inventoryId) || 0);
      });
      var pd = _pick[0];
      if (!pd) {
        // v0.9.1204: "item not saved yet" is the RIGHT call for a note minutes
        // old — the row is about to appear. But a note whose item never
        // arrived (a cancelled add, an item later removed) waited forever:
        // Brad's store still held entries keyed 905 and 2348 from set-adds
        // days earlier, re-examined on every dashboard build. A note gets a
        // generous week to find its row, then retires. Its photos stay safely
        // in the inbox either way — this expires the NOTE, never the photos.
        try {
          // v0.9.1370 — read the timestamp off the OLDEST queued note, not off
          // the key. With a list, `pend[num].ts` is undefined, and an
          // undefined timestamp meant the note could never retire.
          var _first = _pendList(pend[num])[0];
          var _ts = (_first && typeof _first === 'object' && _first.ts) || 0;
          if (_ts && (_rrNowMs() - _ts) > 604800000) {
            var _pe = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
            delete _pe[num];
            localStorage.setItem(PENDING_KEY, JSON.stringify(_pe));
            console.log('[Inbox] retired a pending note whose item never arrived:', num, '(photos stay in the inbox)');
          }
        } catch (eEx) {}
        continue;   // item not saved yet -> leave its photos in the inbox
      }
      _flushingNums[num] = true;
      try {
        // v0.9.1370 — the queue holds one note per COPY. Take the oldest and
        // pair it with the row picked above (which prefers a copy that has no
        // photo link yet). The rest wait for the next dashboard build, by
        // which time this row HAS a photo link, so the next note lands on the
        // next copy instead of piling onto the same one.
        var rec = _pendList(pend[num])[0];
        if (!rec) { try { var _p0 = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); delete _p0[num]; localStorage.setItem(PENDING_KEY, JSON.stringify(_p0)); } catch (e0) {} continue; }
        // v0.9.1118: set-add notes are written without Drive folders (keeps
        // the button instant) — resolve them here, at move time. A failure
        // just leaves the note for the next dashboard build to retry.
        if (rec && typeof rec === 'object' && rec.files && rec.files.length && (!rec.fromFid || !rec.toFid)) {
          try {
            if (!rec.fromFid) rec.fromFid = await _folder();
            if (!rec.toFid) rec.toFid = await driveEnsureItemFolder(num);
            if (!rec.link) rec.link = driveFolderLink(rec.toFid);
          } catch (eF) { console.warn('[Inbox] pending folder resolve failed — will retry:', eF); continue; }
        }
        var link = (rec && typeof rec === 'object') ? rec.link : rec;  // back-compat: old entries were a plain link string
        // v0.9.1192: `rec.moved` records that the Drive move already happened,
        // so the retry introduced below re-tries ONLY the sheet write. Without
        // it, holding the note back would re-walk every file on every build.
        if (rec && typeof rec === 'object' && !rec.moved && rec.files && rec.files.length && rec.fromFid && rec.toFid) {
          var mv = 0;
          for (var fi = 0; fi < rec.files.length; fi++) {
            var file = rec.files[fi]; mv++;
            var ext = (String(file.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
            try {
              await driveMoveFileToFolder(file.id, rec.fromFid, rec.toFid);
              // v0.9.935 (Brad): the photo shown in the wizard's RSV slot files as
              // the Right Side View, so detail pages/thumbnails treat it as primary.
              var _vTag = (rec.rsvFid && file.id === rec.rsvFid) ? ' RSV ' : ' ADD ';
              try { await driveRequest('PATCH', '/files/' + file.id, { name: num + _vTag + ((rec.ts || new Date().getTime()) + mv) + '.' + ext }); } catch (eRn) {}
            } catch (eMv) { console.warn('[Inbox] deferred photo move skipped (removed?):', file.id, eMv); }
          }
          // Remember the move survived, so a held-back note never repeats it.
          rec.moved = true;
          try {
            // v0.9.1370 — mark the note we are actually working on (the first
            // in this number's queue), not "the entry for this number".
            var _pm = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
            var _pmL = _pendList(_pm[num]);
            if (_pmL.length && typeof _pmL[0] === 'object') {
              _pmL[0].moved = true; _pm[num] = _pmL;
              localStorage.setItem(PENDING_KEY, JSON.stringify(_pm));
            }
          } catch (ePM) {}
        }
        // ── v0.9.1192 (Brad: every item added today has no photo link) ──
        // A row that was just appended carries the PLACEHOLDER row 99999 until
        // a sheet sync fills the real one. 99999 is TRUTHY, so `if (pd.row …)`
        // passed and the write addressed S99999 → Sheets 400 "exceeds grid
        // limits" → swallowed by the catch → and the note below was deleted
        // regardless, so it never retried. The photos were already in Drive by
        // then, which is why thumbnails found them and the sheet stayed blank.
        // v0.9.1130 moved the arming to save time, which is when this began.
        // v0.9.695 fixed exactly this for ONE save path and named Brad's
        // abacus; sixteen other sites still hand out the sentinel.
        // A placeholder row is not a row. Hold the note and finish next build.
        var _rowKnown = pd.row && Number(pd.row) !== 99999;
        var _linkDone = true;
        if (!pd.photoItem && link) {
          if (_rowKnown && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && state.personalSheetId) {
            try {
              if (await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[link]], { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection'))
                pd.photoItem = link;   // only true once the sheet actually took it
              else _linkDone = false;   // v0.9.1284: a refused row is a moved row — retry after the next sync
            } catch (eUp) { _linkDone = false; console.warn('[Inbox] pending link write failed — keeping the note to retry:', eUp); }
          } else {
            _linkDone = false;      // row unknown yet — retry once the sync lands
          }
        }
        // v0.9.1201: this item's photo set just changed (files moved in and/or
        // link written) — forget its cached first-photo id so lists and the
        // reel re-resolve instead of showing the old picture forever.
        try { if (typeof rrThumbBust === 'function') rrThumbBust(pd); } catch (eTB) {}
        // Retire the note ONLY when its work finished. Deleting unconditionally
        // is what turned a retryable miss into permanent, silent data loss.
        if (_linkDone) {
          // v0.9.1370 — retire ONLY the note just filed. Any further copies of
          // this number keep their place in the queue; deleting the whole key
          // is what threw Brad's second 3362 away.
          try {
            var p2 = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
            var l2 = _pendList(p2[num]);
            l2.shift();
            if (l2.length) p2[num] = l2; else delete p2[num];
            localStorage.setItem(PENDING_KEY, JSON.stringify(p2));
          } catch (eD) {}
        }
        try { _pinRefresh(); } catch (eR) {}
      } finally { delete _flushingNums[num]; }
    }
  }

  // ── v0.9.1192: repair rows whose photos reached Drive but whose link was
  // lost to the row-99999 write (see PHOTO_LINK_REGRESSION.md). Brad's sheet
  // had 21 of 21 items added on 2026-07-30 in this state — pictures safe,
  // pointer gone, and the detail page reading that blank cell as "no photos".
  //
  // Find-only and deliberately timid: it never creates a Drive folder, only
  // walks rows that have a REAL row number and no link, stops after a small
  // batch per build so a large collection heals over a few visits instead of
  // firing hundreds of requests at once, and treats every failure as "try
  // again next time" rather than as a reason to give up.
  // v0.9.1204: `_repairRan` alone let OVERLAPPING dashboard builds each start
  // a pass (it clears in `finally`, so build B began while build A awaited),
  // re-writing links that were already written — idempotent, but wasted API
  // calls every time. A short cooldown makes a second build within the same
  // moment a no-op instead of a duplicate run.
  function _rrNowMs() { try { return Date.now(); } catch (e) { return 0; } }
  var _repairRan = false, _repairDone = {}, _repairLastAt = 0;
  async function _repairMissingPhotoLinks() {
    if (_repairRan) return;                       // a pass is already in flight
    if (_rrNowMs() - _repairLastAt < 20000) return;   // and not again within 20s of the last one
    if (!window.state || !state.personalData || !state.personalSheetId) return;
    if (typeof driveFindItemFolder !== 'function' || typeof sheetsUpdate !== 'function'
        || typeof personalColLetter !== 'function') return;
    _repairRan = true; _repairLastAt = _rrNowMs();
    try {
      var targets = Object.values(state.personalData).filter(function (p) {
        return p && p.owned && p.itemNum && !p.photoItem
            && p.row && Number(p.row) !== 99999          // a placeholder is not a row
            && !_repairDone[String(p.inventoryId || p.itemNum)];
      }).slice(0, 12);                            // small batch; the rest heal next build
      for (var i = 0; i < targets.length; i++) {
        var p = targets[i], k = String(p.inventoryId || p.itemNum);
        _repairDone[k] = true;                    // don't re-probe this row this session
        var link = '';
        // v0.9.1325: the WRITE failure below deletes the sentinel so the row
        // retries; the LOOKUP failure did not, so one Drive hiccup skipped
        // that row for the whole session and its detail page kept saying "no
        // photos" — cured by a reload, so it looked intermittent. This
        // function's own doc comment claims it "treats every failure as 'try
        // again next time'"; one of its two failure paths didn't.
        try { link = await driveFindItemFolder(p.itemNum); }
        catch (eF) { delete _repairDone[k]; continue; }
        if (!link) continue;                      // genuinely has no folder — leave it alone
        try {
          if (!(await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, p.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + p.row, [[link]], { num: p.itemNum || '', invId: p.inventoryId || '' }, 'collection'))) continue;
          p.photoItem = link;
          console.log('[Inbox] repaired photo link for', p.itemNum);
        } catch (eW) { delete _repairDone[k]; console.warn('[Inbox] photo-link repair deferred:', p.itemNum, eW); }
      }
    } catch (e) { console.warn('[Inbox] photo-link repair pass:', e); }
    finally { _repairRan = false; }               // eligible again on the next build
  }

  // ── v0.9.1199: backfill Master Keys for rows saved before v0.9.1198 ──
  // New saves store WHICH catalog row the user confirmed (col AK). Brad's
  // existing 168 rows predate that; this walks them once and writes each
  // row's best resolution — the SAME answer every render already trusts,
  // computed once with full context (era + maker + variation as prefer) and
  // then never re-guessed. Wired beside _repairMissingPhotoLinks and paced
  // the same way, with tonight's starvation lesson applied: RESOLUTION is
  // in-memory and free, so every row is examined each pass — only the sheet
  // WRITES are capped (12/build). A row that resolves to nothing is done
  // (off-catalog; nothing to store); a row whose WRITE fails is re-queued.
  var _mkDone = {};
  async function _backfillMasterKeys() {
    if (!window.state || !state.personalData || !state.personalSheetId) return;
    if (typeof findMaster !== 'function' || typeof rrMasterKeyOf !== 'function'
        || typeof sheetsUpdate !== 'function' || typeof personalColLetter !== 'function') return;
    var wrote = 0;
    // v0.9.1252 (row-identity audit, finding 15): iterate ENTRIES so the
    // store key is available. The done-marker used to be rebuilt from
    // p.row for rows with no Inventory ID — but _adjustRowsAfterDelete
    // mutates .row in place and _mkDone is module-scope, so a marker minted
    // before a deletion named a DIFFERENT copy afterwards and that copy was
    // skipped for the rest of the session, never getting its Master Key.
    // The store key is minted once per load and never recomputed.
    var rows = Object.entries(state.personalData);
    for (var i = 0; i < rows.length; i++) {
      var _storeKey = rows[i][0];
      var p = rows[i][1];
      if (!p || !p.owned || !p.itemNum || p.masterKey) continue;
      if (String(p.era || '') === 'Manual') continue;            // a manual entry's identity is its own
      if (!p.row || Number(p.row) === 99999) continue;           // a placeholder is not a row
      var k = String(p.inventoryId || _storeKey);
      if (_mkDone[k]) continue;
      var m = null;
      try { m = findMaster(p.itemNum, p.variation || '', p); } catch (e) {}
      var key = m ? rrMasterKeyOf(m) : '';
      if (!key) { _mkDone[k] = true; continue; }                 // off-catalog — nothing to store, no API spent
      if (wrote >= 12) continue;                                 // write cap only; resolution stays free
      try {
        if (!(await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, p.row, PERSONAL_TAB + '!' + personalColLetter('masterKey') + p.row, [[key]], { num: p.itemNum || '', invId: p.inventoryId || '' }, 'collection'))) continue;
        p.masterKey = key;                                       // memory learns it the moment the sheet does
        _mkDone[k] = true;
        wrote++;
        console.log('[MasterKey] backfilled', p.itemNum, key);
      } catch (e) { console.warn('[MasterKey] backfill deferred:', p.itemNum, e && e.message); }
    }
  }
  if (typeof window !== 'undefined') window._rrBackfillMasterKeys = _backfillMasterKeys;

  // ── Batch AI identify (Phase 3, v0.9.886) ────────────────────
  // One button: every un-identified item group gets its FIRST photo
  // run through the existing identify relay (ai-id.js → Gemini).
  // Suggestions persist in localStorage, show on the tiles, and
  // pre-fill the File-to-item dialog. Sequential + cancelable.
  var IDS_KEY = 'rr_inbox_ids';
  // v0.9.1324 (MEASURED, not guessed): _ids() is called once PER TILE inside
  // _render()'s map — and again by _pinStatusOf — so one repaint parsed this
  // whole store once for every visible photo. At 500 photos the store is
  // ~380KB, so a single repaint parsed ~190MB of JSON: 1,097ms on a desktop
  // and 5,705ms on a phone. And _render() fires after EVERY photo the reader
  // finishes, so the repaints alone roughly DOUBLED a 500-photo run that the
  // app itself estimates at 24 minutes.
  //
  // The fix caches the PARSED object keyed on the exact string it came from.
  // Keying on the raw text rather than invalidating in _idsSave is deliberate
  // and load-bearing: any writer at all — this file, another tab, a test that
  // pokes localStorage directly — changes the text and therefore busts the
  // cache for free. (The invalidate-in-_idsSave version measured slightly
  // faster and FAILED 12 assertions, because the suite writes the store
  // directly. Cheaper is not better if it is wrong.)
  //
  // Measured after: 5,705ms -> 127ms on a phone (45x), 1,097ms -> 13ms desktop.
  //
  // One caveat worth writing down: successive calls now hand back the SAME
  // object, so a caller that mutated the result without calling _idsSave would
  // leak that mutation to the next reader. rr_inbox_ids is written in exactly
  // one place (_idsSave, just below) and nowhere else in app/ — checked.
  var _idsRaw = null, _idsObj = null;
  function _ids() {
    try {
      var raw = localStorage.getItem(IDS_KEY) || '{}';
      if (_idsObj && raw === _idsRaw) return _idsObj;
      _idsObj = JSON.parse(raw); _idsRaw = raw;
      return _idsObj;
    } catch (e) { _idsRaw = null; _idsObj = null; return {}; }
  }
  function _idsSave(m) { try { localStorage.setItem(IDS_KEY, JSON.stringify(m)); } catch (e) {} }

  // v0.9.961 (Brad): persistent set of file IDs we've cropped. drive.js reads
  // window._rrForceFreshBytes to load their real (cropped) bytes instead of
  // Drive's stale server preview. Survives reloads via localStorage.
  function _cropped() { try { return JSON.parse(localStorage.getItem(CROPPED_KEY) || '{}'); } catch (e) { return {}; } }
  function _croppedSave(m) { try { localStorage.setItem(CROPPED_KEY, JSON.stringify(m)); } catch (e) {} window._rrForceFreshBytes = m; }
  function _markCropped(fid) { if (!fid) return; var c = _cropped(); c[fid] = 1; _croppedSave(c); }
  // Publish the current markers to drive.js up front, and again after each load
  // (pruned to what's still in the inbox so the set can't grow without bound).
  window._rrForceFreshBytes = _cropped();

  var _idAbort = false;
  window._pinIdentifyCancel = function () { _idAbort = true; };

  async function _pinBytes(fileId) {
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: { Authorization: 'Bearer ' + window.accessToken } });
    if (!r.ok) throw new Error('photo download ' + r.status);
    return await r.blob();
  }

  // ── FREE auto-read: read the catalog number off each photo with on-device
  //    OCR (Tesseract.js from CDN) — no AI credits, runs in the background as
  //    photos land. Reads that the master confirms show as a solid number;
  //    unconfirmed reads show as a hedge; photos it can't read stay open for
  //    the paid AI. OCR is optional: if it won't load, paid identify still works.
  var _tessWorker = null, _tessTried = false, _autoReadBusy = false, _autoReadAbort = false;
  var FREE_TRIED_KEY = 'rr_inbox_freetried';
  function _freeTried() { try { return JSON.parse(localStorage.getItem(FREE_TRIED_KEY) || '{}'); } catch (e) { return {}; } }
  function _freeTriedSave(m) { try { localStorage.setItem(FREE_TRIED_KEY, JSON.stringify(m)); } catch (e) {} }

  function _loadTesseract() {
    if (window.Tesseract) return Promise.resolve(true);
    if (_loadTesseract._p) return _loadTesseract._p;
    _loadTesseract._p = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';  // v0.9.1408: pinned exact (was @5 — a floating major that could swap the OCR engine under us on any load)
      s.onload = function () { resolve(!!window.Tesseract); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return _loadTesseract._p;
  }

  async function _tessGet() {
    if (_tessWorker) return _tessWorker;
    if (_tessTried && !window.Tesseract) return null;
    if (!(await _loadTesseract())) { _tessTried = true; return null; }
    try {
      _tessWorker = await Tesseract.createWorker('eng');
      // v0.9.1065: page-segmentation 6 ("one uniform block") nearly tripled the
      // free reader's hits in the audit on Brad's own 73 photos — 35 confirmed
      // against 13 for the shipping default. A model train photo is scattered
      // lettering on a body, not a page of prose, and the default mode was
      // trying to read it as a document.
      await _tessWorker.setParameters({
        tessedit_char_whitelist: '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        tessedit_pageseg_mode: '6',
      });
    } catch (e) { _tessWorker = null; }
    _tessTried = true;
    return _tessWorker;
  }

  async function _scaledCanvas(blob, maxDim) {
    var bmp = await createImageBitmap(blob);
    var sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    // v0.9.1065: a full histogram stretch, not a fixed contrast bump. A silver
    // passenger car occupies a narrow band of greys and a fixed multiplier
    // barely moves it; stretching whatever range the photo actually uses out to
    // full black-to-white is what makes those numbers legible.
    try { _stretchCanvas(c); } catch (e) {}
    return c;
  }

  // Grayscale, then map the darkest pixel to black and the lightest to white.
  function _stretchCanvas(c) {
    var ctx = c.getContext('2d');
    var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    var lo = 255, hi = 0, i, g;
    for (i = 0; i < d.length; i += 4) {
      g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    var span = Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) {
      var v = (d[i] - lo) * 255 / span;
      d[i] = d[i + 1] = d[i + 2] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    ctx.putImageData(img, 0, 0);
  }

  // Pull the best catalog-number candidate out of OCR text and confirm it
  // against the master. Busy box photos are full of noise text (marketing
  // copy, UPC barcodes, prices, years), so we: drop UPC/barcode-length runs,
  // PREFER a number the master actually knows, and prefer dashed catalog-style
  // numbers (6-17259, 6464-475) over bare digit blobs.
  // v0.9.1063 — two changes, both from Brad's inbox.
  //
  // (a) TWO-DIGIT NUMBERS. The token filter required 3 characters, to stop junk
  //     like a "26" wheel arrangement becoming an item number. It also threw
  //     away every genuine two-digit Lionel number: his Great Northern 58 could
  //     never be read, no matter how sharp the photo. Short tokens are now kept
  //     but must be CONFIRMED by the master list — 58 is a real catalog number
  //     and survives; a stray 26 is not and does not.
  //
  // (b) ERA. `prefer` is the photo's own era stamp, handed to findMaster, which
  //     already knows how to weight a catalog tab (+8) and a maker (+4). His
  //     2410 Santa Fe car, stamped Lionel Postwar O, was misread as "210" and
  //     then matched against a Lionel PRE-WAR standard-gauge switch pair. The
  //     app had the era written on the photo and was not using it.
  function _numberFromText(text, prefer) {
    if (!text) return null;
    var UP = String(text).toUpperCase();
    // v0.9.1168: numbers the user has explicitly rejected on this photo. Filtered
    // out at the CANDIDATE stage, so every downstream path — direct hit, join,
    // dash repair, quote match, hedge — is covered by one rule rather than five.
    var _rejN = function (v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var _rejectSet = ((prefer && prefer.reject) || []).map(_rejN).filter(Boolean);
    var _isRejected = function (c) {
      return _rejectSet.length > 0 && _rejectSet.indexOf(_rejN(c)) >= 0;
    };
    // v0.9.1277 (Brad's 6561 read as 1656): remember WHICH direct tokens the
    // reject list silenced. If one of them turns out to be stamped beside the
    // maker's own name, the human needs to hear that before any
    // reconstruction gets asserted in its place.
    var _rejSeen = [];

    // v0.9.959 (Brad): a 4-digit number sitting next to a © or a copyright
    // holder is a YEAR, not the catalog number — the Thomas box's "© 2012
    // LIONEL" was being read as item #2012. Ban those exact year tokens so they
    // can never be offered. Real Lionel numbers like 2037 / 2046 are never in a
    // copyright context, so they're untouched.
    var banned = {}, m;
    var reCopy = /(?:©|\(C\)|COPYRIGHT)\s*((?:19|20)\d{2})/g;
    while ((m = reCopy.exec(UP))) { banned[m[1]] = 1; }
    // ©-dropped fallback: OCR sometimes misses the © glyph, leaving "2012
    // GULLANE (THOMAS) LIMITED". Ban a year-range number only when a legal
    // suffix (L.L.C / LIMITED / INC …) sits within ~25 chars after it — that's
    // unmistakably a copyright line, not an item marking.
    var reHolder = /\b((?:19|20)\d{2})\b(?=[^0-9]{0,25}(?:L\.?L\.?C\b|LLC\b|LIMITED\b|LTD\b|\bINC\b|CORP\b|ENTERTAINMENT\b|TRADEMARK\b|GMBH\b))/g;
    while ((m = reHolder.exec(UP))) { banned[m[1]] = 1; }
    // v0.9.1065 — BUILD DATES. The audit read "5-54" off five different cars
    // and the catalog confirmed every one, because numbers like that collide
    // with real entries. They are not item numbers: Lionel stamps the build
    // date on the side of postwar rolling stock ("BLT 5-54" = May 1954), and it
    // is frequently the crispest printed thing in the photo. A real catalog
    // number never looks like this — dashed Lionel numbers are 6464-475 or
    // 2333-20, three or four digits before the dash, never one or two.
    // v0.9.1069 — widened. "10-2210" slipped through a rule that only looked
    // for one or two digits AFTER the dash. Real dashed Lionel numbers are
    // 6464-475 or 2333-20: three or four digits BEFORE it, always.
    // ══ v0.9.1076 — the strongest signal on the model itself ═══════════════
    // Brad's Lehigh Valley hopper carries FOUR numbers: road number 25000 in the
    // largest lettering, CAPY 100000, LD LMT 128300, and — in the smallest print
    // on the car — "BUILT 1-48 LIONEL 6176". Only the last is the catalog
    // number, and the car tells you which by putting it directly after the
    // maker's name. That is a manufacturing convention, not a guess: Lionel
    // stamps its catalog number next to LIONEL on essentially every postwar
    // piece. It is also exactly the cue a collector's eye uses.
    var namedByMaker = {};
    (function () {
      // v0.9.1077d — Brad's Lionel 50 gang car came through as "IONEL DE 50":
      // the maker's own name is long, curved and often the first thing OCR
      // mangles. Requiring it spelled perfectly threw away the strongest signal
      // we have precisely when the reading was rough. L1ONEL, IONEL, LIONE and
      // LIONEL all count; the pattern is still specific enough that nothing
      // else on a train matches it.
      var MAKER = '(?:[LI1][I1l]?[O0]NEL|LI[O0]NE)';
      // The gap allows a little junk, not just spaces: Brad's gang car reads
      // "IONEL DE 50" — OCR invents letters between the name and the number as
      // readily as it mangles the name itself. Ten non-digit characters is wide
      // enough for that and far too narrow to reach the next real number.
      var reAfter = new RegExp(MAKER + '(?:[ ]?LINES)?[^0-9]{0,10}(\\d{2,6}(?:-\\d{1,3})?)', 'g');
      var reBefore = new RegExp('(\\d{2,6}(?:-\\d{1,3})?)[^0-9]{0,10}' + MAKER, 'g');
      var mm;
      while ((mm = reAfter.exec(UP))) { namedByMaker[mm[1]] = 1; }
      while ((mm = reBefore.exec(UP))) { namedByMaker[mm[1]] = 1; }
    })();

    // ══ ROAD NUMBERS AND WEIGHTS ARE TOO LONG TO BE CATALOG NUMBERS ════════
    // Postwar and prewar Lionel numbers top out at four digits — 6464 is about
    // as long as they get — so on a photo stamped as one of those eras, a bare
    // five- or six-digit number is never the answer. 25000 (a road number that
    // also happens to exist in the catalog as a Mathematics Set), 100000 and
    // 128300 all fail here. MPC, MTH and the rest genuinely use longer numbers
    // and are deliberately left alone.
    var MAX_PLAIN_DIGITS = { prewar: 4, pw: 4 };
    // v0.9.1167: the cap applies when EVERY era the filter covers has one —
    // take the most permissive. A single covered era behaves exactly as before.
    var digitCap = (function () {
      var es = _prefEras(prefer);
      if (!es.length) return 0;
      var mx = 0;
      for (var i = 0; i < es.length; i++) {
        var c = MAX_PLAIN_DIGITS[es[i]];
        if (!c) return 0;                           // one uncapped era = no cap
        if (c > mx) mx = c;
      }
      return mx;
    })();

    // v0.9.1084 — this shape means different things in different catalogs.
    // "5-54" on a postwar car is a build date. "6-16661" is a real modern Lionel
    // SKU. Banning it everywhere would make MPC and MTH items unidentifiable, so
    // it only applies where such a number cannot be a catalog number — the same
    // eras that cap plain numbers at four digits.
    // Allowed ONLY on a photo stamped as an era that genuinely uses the format —
    // Lionel MPC (6-16661), MTH (20-xxxxx). On a postwar or prewar photo, and on
    // an UNSTAMPED one, it stays banned: without an era we cannot tell a build
    // date from a modern SKU, and defaulting to "date" is what keeps 5-54 out.
    var _shortDashOk = !!(_prefEras(prefer).length && !digitCap);   // v0.9.1167
    var isBuildDate = function (c) { return !_shortDashOk && /^\d{1,2}-\d+$/.test(c); };
    // CAPACITY AND LOAD LIMIT. The audit confirmed "40200" on five different
    // cars, plus 48200 and 25000. Those are the CAPY / LD LMT stamps printed on
    // the side of every freight car — genuinely on the item, genuinely in some
    // catalog somewhere, and never what the user is looking at. Same shape as
    // the build-date problem, different costume.
    var reCap = /(?:CAPY|CAP'?Y|LD\s*LMT|LDLMT|LT\s*WT|LTWT|WT\s*LMT|CAPACITY)[^0-9]{0,10}(\d{3,7})/g;
    var capStamp = {};
    while ((m = reCap.exec(UP))) { capStamp[m[1]] = 1; }
    var toks = (UP.match(/\d[\dA-Z]*(?:-[\dA-Z]+)*/g) || [])
      .map(function (c) { return c.replace(/^-+|-+$/g, ''); })
      .filter(function (c) {
        if (!/\d/.test(c) || c.length < 2 || c.length > 10) return false;
        if (banned[c]) return false;                            // copyright year, not a catalog number
        if (isBuildDate(c)) return false;                       // "BLT 5-54" — a date, not an item
        if (capStamp[c.replace(/\D/g, '')]) return false;        // "CAPY 40200" — a weight, not an item
        if (_isRejected(c)) { if (_rejSeen.indexOf(c) < 0) _rejSeen.push(c); return false; }   // the user already said this is wrong
        // v0.9.1071: the weight block on a freight car reads CAPY 103000,
        // LD LMT 129300, LT WT 40200 — and OCR garbles those labels often
        // enough that keyword matching alone misses them. No Lionel catalog
        // number has six or more digits, so on a Lionel-stamped photo they are
        // never the answer regardless of what the label came out as.
        // The era-aware ceiling replaces the blunt six-digit rule.
        if (digitCap && c.indexOf('-') < 0 && c.replace(/\D/g, '').length > digitCap) return false;
        if (!digitCap && _prefEras(prefer).length && /^\d{6,}$/.test(c)) return false;   // v0.9.1167
        var digits = c.replace(/\D/g, '');
        var alnum = c.replace(/[^0-9A-Za-z]/g, '');
        if (digits.length < alnum.length * 0.6) return false;   // mostly letters = junk (e.g. "4LIONEL", "MADE")
        if (digits.length >= 8 && c.indexOf('-') < 0) return false;   // UPC / barcode run
        return true;
      });
    var seen = {}, uniq = [];
    toks.forEach(function (c) { if (!seen[c]) { seen[c] = 1; uniq.push(c); } });
    // v0.9.1069 — THE ERA IS NOW A FILTER, not a tiebreak. Brad's idea, taken
    // one step on. Until now a token counted as confirmed if it existed in ANY
    // catalog, which is how a capacity stamp on a Lionel Postwar car "confirmed"
    // against something in another maker's list. If the photo says which catalog
    // it belongs to, a number that is not in THAT catalog is not a confirmation.
    //
    // The real prize is not the rejection — it is what happens next. A rejected
    // token falls through and the NEXT candidate in the same text gets its turn,
    // which is often the number actually printed on the item. It turns a wrong
    // answer into a right one rather than into a blank.
    // v0.9.1093 (Brad: "why are we matching to set item numbers"). His 6817
    // scraper came back "1545 — 027 Diesel Freight Set" and his 6817 earlier
    // hit "1615 — Cannonball Express Set". The master list indexes SET rows
    // alongside item rows, and text scraped off a photo was allowed to confirm
    // against them. A number painted on a car is an ITEM number — set numbers
    // live on boxes and paperwork, not on rolling stock. Set rows are invisible
    // to the free reader's validation now. (The PAID reader is untouched: it
    // sees the photo, and a photo genuinely can be of a boxed set.)
    var _isSetRow = _pinIsSetRow;   // v0.9.1094: hoisted — three indexes share it now
    // v0.9.1168 — THE CHOKEPOINT for a rejected answer. Filtering the producers
    // was whack-a-mole: the token list, the maker-adjacent scan, the whole-run
    // reconstruction and the sliding-window slicer each build candidates their own
    // way, and a rejected number kept reappearing through whichever one had not
    // been patched yet. But every one of them has to come THROUGH here to become an
    // answer, because this is the only thing that turns digits into a catalog row.
    // One guard here covers direct hits, joins, windows, dash repairs, the hedge
    // and the quote match — and any path added later gets it for free.
    var fmAny = (typeof findMaster === 'function')
      ? function (c) {
          if (_isRejected(c)) return null;
          var r = findMaster(c, null, prefer || null);
          return (r && !_isSetRow(r)) ? r : null;
        }
      : null;
    // v0.9.1167 (Brad: "if i once again tell you its a lionel, don't suggest to
    // me atlas"). THE FIFTH COPY of the single-era gate, and the one that was
    // still live. His chips were Lionel / O / Modern, but when a filter covers
    // more than one era `prefer.era` is '' — so this returned true for EVERY row,
    // every catalog counted, and a number assembled out of OCR fragments went
    // shopping until some maker's list accepted it. His MKT steam locomotive came
    // back "2500 — Atlas Undecorated (Low Nose)", and the disclosure said so in
    // as many words: "Photo is stamped: nothing — no era filter applied".
    //
    // v0.9.1165 widened four of these gates and missed this one. Fifth place,
    // same class, enumerated from source this time.
    var _inEraSet = _prefEras(prefer);
    var inEra = function (row) {
      if (!_inEraSet.length) return true;           // genuinely unfiltered — old behaviour
      return !!(row && _inEraSet.indexOf(row._era) >= 0);
    };
    // v0.9.1167 — THE CAP FOLLOWS THE CANDIDATE'S ERA, not the filter's.
    // Brad's A.T.&S.F. gondola is stamped CAPY 100000 / LD LMT 120000 / LT WT
    // 40200, and it came back "40200 — Atlas N UNDECORATED (ADM/MCP)". The rule
    // meant to stop that is MAX_PLAIN_DIGITS ({prewar:4, pw:4}): no Lionel
    // pre-war or postwar catalog number has five plain digits, so a five-digit
    // run on such a car is a weight, never the item. But it was keyed on
    // prefer.era — one era — so a filter covering two eras switched it off, and
    // the keyword rule above it could not help either because OCR had shredded
    // the words "LT WT" into "- 4 - - - - -".
    //
    // Asking the CANDIDATE's own row instead needs no filter at all: if the row
    // this number would match is pre-war or postwar Lionel, a five-digit plain
    // number cannot be it, whatever the user is filtered to.
    // v0.9.1167 (Brad: "if i once again tell you its a lionel, don't suggest to
    // me atlas"). An off-era LEAD is a genuinely useful offer WITHIN a maker: a
    // postwar number read off a car while the user sits in Lionel Modern is worth
    // putting in front of them. Across makers it is noise in an answer's clothes.
    // His MKT locomotive was handed "2500 — Atlas O (Low Nose)" and his
    // A.T.&S.F. gondola "40200 — Atlas N (ADM/MCP)", each because the digits
    // existed in SOME catalog. If the filter names a maker, another maker's row is
    // not a lead — it is a different product that happens to share a number.
    var _sameMakerAsFilter = function (row) {
      var want = String((prefer && prefer.manufacturer) || '').toLowerCase().trim();
      if (!want) return true;                       // no maker named — nothing to contradict
      var got = '';
      try {
        if (typeof _manufacturerOfEra === 'function') {
          got = String(_manufacturerOfEra(row && row._era) || '').toLowerCase();
        }
      } catch (e) {}
      if (!got && row && row._tab) got = String(row._tab).toLowerCase().split(' ')[0];
      if (!got) return true;                        // unknown maker — never hide on a guess
      return got === want || got.indexOf(want) === 0 || want.indexOf(got) === 0;
    };
    var _capForRow = function (row, c) {
      if (!row || !row._era) return false;
      var cap = MAX_PLAIN_DIGITS[row._era];
      if (!cap) return false;
      var plain = String(c || '');
      if (plain.indexOf('-') >= 0) return false;      // dashed numbers are catalog-shaped
      return plain.replace(/\D/g, '').length > cap;
    };
    var fm = fmAny ? function (c) {
      var r = fmAny(c);
      if (!r || !inEra(r)) return null;
      if (_capForRow(r, c)) return null;              // a weight stamp, not a catalog number
      return r;
    } : null;
    // v0.9.1065 — short tokens are a LEAD, never a fact. Catalog backing is
    // too weak a filter for them on its own: the audit turned stray markings
    // into 13, 20, 25, 40, 50, 53 and 77, and Lionel has real items at every
    // one of those numbers, so each was reported as confirmed. They are kept
    // (Brad's Great Northern 58 is genuine) but only when nothing longer was
    // found, and they are always returned as a best guess for a human to
    // accept — never stated as certain.
    var shortOnes = uniq.filter(function (c) {
      return c.replace(/\D/g, '').length < 3 && fm && fm(c);
    });
    // v0.9.1078: a short number is weak because it could be anything — but not
    // when the maker stamped its own name beside it. "LIONEL 50" on Brad's gang
    // car is as strong a statement as a car can make, and it was being demoted
    // to a hedge purely for being two digits. Promote those back.
    uniq = uniq.filter(function (c) {
      if (c.replace(/\D/g, '').length >= 3) return true;
      return !!namedByMaker[c];
    });
    shortOnes = shortOnes.filter(function (c) { return !namedByMaker[c]; });
    var dashRank = function (a, b) {
      return (b.indexOf('-') >= 0 ? 1 : 0) - (a.indexOf('-') >= 0 ? 1 : 0) || b.length - a.length;
    };
    // v0.9.1070 — say WHY. Brad re-read a Santa Fe 2412 and it still came back
    // as an MPC set number, and I could not tell from the outside whether the
    // era filter had run, whether the photo was stamped at all, or whether the
    // right number had even been a candidate. Guessing at that from screenshots
    // is what this whole audit was supposed to replace. Every read now carries
    // its own reasoning.
    // ══ v0.9.1076c — HOW MUCH DID IT ACTUALLY READ? ════════════════════════
    // Brad's 2408 Santa Fe car produced the entire text "-600 2" and the app
    // reported No. 600, NW2 Switcher, as a finding. His M&StL boxcar produced
    // "- 7 - 5 - 1001- - 4 - 0" and got 1001, a steam locomotive. Both numbers
    // are real postwar items, so both confirmed. But a catalog hit inside four
    // characters of noise is a coincidence, not a reading — with a few thousand
    // numbers in the catalog, almost any stray digits land on one.
    //
    // So a match needs some corroboration around it. Below this much recovered
    // text the answer is still offered, as a guess for a human to accept, but it
    // is never stated as fact.
    var evidence = UP.replace(/[^0-9A-Z]/g, '').length;
    // ══ v0.9.1168 — NOTHING WAS READ, SO NOTHING IS THE ANSWER ═════════════
    // Brad's MKT 0-8-0 carries no lettering at all: the herald is a graphic, the
    // cab number is a decal the OCR broke up, and the recovered text was
    //   "- -- -- 3 43 -- - - 9 7 - - - 4 - - - - - 3 10 --- - 5 - 4 ... 2 2500 ..."
    // Eighteen characters, not one of them a LETTER. The re-scan said "No number
    // picked up automatically" — correct — and then a later pass joined scattered
    // digits into 2233810, seven digits that happen to be a real Lionel row (an
    // AT&SF F7 A-A set). Right maker, so v0.9.1167's refusal cannot catch it;
    // completely the wrong item.
    //
    // A catalog number printed on a model never sits alone. LIONEL, a road name,
    // BLT, CAPY, NEW — something lettered is always beside it, and the same OCR
    // that can resolve the digits can resolve those. Text with NO letters in it
    // means nothing was truly read, only artifacts of light and shadow, and a
    // number assembled from artifacts is an artifact.
    //
    // Brad said it plainly: "I know there is not text on here to read and don't
    // expect it to get it right." Saying so IS the answer, and it costs him one
    // step (type it, or spend a read) instead of five spent unpicking a confident
    // wrong item.
    var _noLetters = !/[A-Z]/.test(UP);
    var THIN = 18;

    var dbg = {
      era: (prefer && prefer.era) || '',
      evidence: evidence,
      cand: uniq.slice(0, 8),
      shortCand: shortOnes.slice(0, 5),
      inEra: [],
      offEra: [],
      joined: '',
      viaMaker: '',
      // v0.9.1277: the marks are invisible nowhere now — every read narrates
      // what the user has excluded, because a silent exclusion of the RIGHT
      // answer reads exactly like a wrong reader.
      rejectedList: ((prefer && prefer.reject) || []).slice(0, 6),
    };
    uniq.slice(0, 8).forEach(function (c) {
      var any = fmAny ? fmAny(c) : null;
      if (!any) return;
      (inEra(any) ? dbg.inEra : dbg.offEra).push(c + (any._era ? ':' + any._era : ''));
    });
    // v0.9.1071 — SPLIT NUMBERS. Brad: "this is a hard number to read because
    // the number is 3562-1 and its split on the car." He was describing the
    // mechanism exactly, and the raw text proved it. On that ATSF gondola the
    // reader saw:
    //
    //     ... CAPY 100000  3 3 5 6 2 1  LD LMT 128000 ...
    //
    // The number is stamped across separate raised panels, so it arrives as six
    // SINGLE DIGITS. Every one of them is discarded before any catalog lookup —
    // a lone "3" is not a token worth considering — so 3562-1 never had a
    // chance, however sharp the photo. No amount of image processing fixes this;
    // the characters were read correctly and then thrown away.
    //
    // So: take runs of digits separated only by spaces, close them up, and try
    // every contiguous window of catalog-plausible length, exact and then
    // dash-repaired. "3 3 5 6 2 1" closes to 335621, whose window 35621 repairs
    // to 3562-1, which the catalog knows. Only ever accepted on an exact hit in
    // the stamped catalog, so this recovers numbers that were already there and
    // cannot invent one.
    var joined = [];
    (function () {
      var runs = UP.match(/\d(?:[ \t]?\d){3,11}/g) || [];
      runs.forEach(function (run) {
        var d = run.replace(/\D/g, '');
        if (!d || d.length < 4) return;
        if (capStamp[d] || banned[d]) return;         // a weight or a copyright year
        for (var len = Math.min(8, d.length); len >= 4; len--) {
          for (var st = 0; st + len <= d.length; st++) {
            var w = d.substr(st, len);
            // v0.9.1076b: the join was bypassing every guard the direct path
            // has. On Brad's Lehigh Valley hopper it reassembled the ROAD
            // NUMBER 25000 out of "LEY 25000" and won on length, after the
            // ordinary filters had correctly thrown that very number away.
            // A recovery route must not be a way around the rules.
            if (capStamp[w] || banned[w]) continue;
            if (joined.indexOf(w) < 0) joined.push(w);
          }
        }
      });
    })();

    // v0.9.1072b — ORDER MATTERS, and I had it wrong. On Brad's ATSF gondola the
    // reader saw "... 35 621 ..." and the direct match ran first, so "621" — the
    // tail half of 3562-1, sitting on its own panel — was accepted as a catalog
    // number before the joining step was ever reached. A fragment that happens
    // to exist in the catalog beat the complete number it was part of.
    //
    // Both are computed now and the LONGER confirmed number wins. That is the
    // right tie-break on its own terms: 3562-1 is more specific than 621, and a
    // catalog hit on more digits is far less likely to be a coincidence.
    var direct = null;
    var matched = uniq.filter(function (c) { return fm && (fm(c) || fm(c.replace(/^\d-/, ''))); });
    if (matched.length) {
      // A number the maker put its own name beside outranks everything, before
      // any length or specificity tie-break gets a say. Length was deciding this
      // and length is meaningless between two unrelated numbers — it picked the
      // road number 25000 over the catalog number 6176 purely for being longer.
      var named = matched.filter(function (c) { return namedByMaker[c]; });
      if (named.length) { named.sort(dashRank); direct = named[0]; dbg.viaMaker = direct; }
      else {
        matched.sort(dashRank);
        // v0.9.1104 (Brad's 6816 asserted as "1043 — Transformer"): BOTH were
        // valid in-era candidates. 6816 was read three times — twice by the
        // light-numbers pass, straight off the car — while 1043 appeared once,
        // inside the catalog page pinned to the wall above the shelf. The
        // tiebreak was position in the text. Evidence decides now: the
        // candidate read MOST OFTEN wins; dashRank still breaks real ties.
        var _bestC = matched[0], _bestF = -1;
        matched.forEach(function (cD) {
          var _lit = cD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          var _f = (UP.match(new RegExp('\\b' + _lit + '\\b', 'g')) || []).length;
          if (_f > _bestF) { _bestF = _f; _bestC = cD; }
        });
        if (_bestC !== matched[0]) dbg.freqPick = _bestC + ' (read ' + _bestF + '\u00d7)';
        direct = _bestC;
      }
    }

    // ══ v0.9.1079 — one misread digit ══════════════════════════════════════
    // Brad, on his Boston & Maine boxcar: "i see where it read 5 instead of 6.
    // so it says 5464475 instead of 6464475. we may need to look at a number
    // being off like 5 and 6 or 5 and 8." Exactly right, and the fix is narrow
    // enough to be safe: try changing ONE character to something it is commonly
    // confused with, and accept only an exact catalog hit. A single substitution
    // on a seven-digit run is about fifteen candidates — cheap — while allowing
    // two would let almost anything become almost anything.
    var _OCR_CONFUSE = {
      '0': '68', '1': '7', '2': '7', '3': '8', '4': '9',
      '5': '68', '6': '58', '7': '1', '8': '360', '9': '4',
    };
    function _oneOffVariants(d) {
      var out = [];
      for (var i = 0; i < d.length; i++) {
        var alt = _OCR_CONFUSE[d[i]];
        if (!alt) continue;
        for (var j = 0; j < alt.length; j++) {
          out.push(d.slice(0, i) + alt[j] + d.slice(i + 1));
        }
      }
      return out;
    }
    // v0.9.1097 (Brad's 6175 asserted as "1523 — Diesel Freight Set, 81"):
    // the v0.9.1093 set exclusion keys on the tab name, but Brad's workbook
    // also carries set rows INSIDE the items list, where the tab cannot give
    // them away. Their own descriptions can. A RECONSTRUCTED number — glued
    // from scattered digits, windowed, or one-digit-repaired — must not
    // validate against a row that describes a boxed outfit; set numbers live
    // on boxes and paperwork, not stamped on rolling stock. Direct tokens
    // are deliberately untouched: "110" painted on a box lid is a legitimate
    // direct read even though its row says "Trestle Set".
    var fmJoin = fm ? function (c) {
      var row = fm(c);
      if (!row) return null;
      if (/\b(set|outfit)\b/i.test(String(row.description || ''))) return null;
      return row;
    } : null;

    // Exact, then dash-repaired, for one candidate string.
    function _tryNumber(d) {
      if (!fmJoin) return null;
      if ((!digitCap || d.length <= digitCap) && fmJoin(d)) return d;
      for (var cut = 3; cut <= 4; cut++) {
        if (d.length <= cut) continue;
        var cand = d.slice(0, cut) + '-' + d.slice(cut);
        if (fmJoin(cand)) return cand;
      }
      return null;
    }

    var jHit = null, wholeRuns = [], _jSrc = '';
    // Whole runs first, and a one-character repair of them, BEFORE any window.
    // Order matters: "5464475" cut into windows yields "6447", a real postwar
    // caboose, and it was winning over the boxcar the car actually is. A
    // complete number with one digit corrected beats a fragment of it.
    if (fm) {
      // v0.9.1168: remember HOW each run was obtained. An unbroken run of digits
      // was genuinely read — Brad's "5464475" is 6464-475 with one digit misread,
      // and repairing it is the whole point of this path. A run glued together
      // across gaps is a different animal: on his MKT locomotive, scattered
      // singles and pairs were welded into 2233810, a real Lionel row and utterly
      // the wrong item. Same code path, opposite trustworthiness.
      var _runSrc = {};
      var _addRun = function (d, src) {
        if (d && d.length >= 4 && d.length <= 12 && !capStamp[d] && !banned[d]
            && wholeRuns.indexOf(d) < 0) { wholeRuns.push(d); _runSrc[d] = src; }
      };
      // An UNBROKEN digit token first — that is the printed number when the
      // reader managed to keep it together, and it is what "5464475" is. Only
      // then the space-joined runs, which on this car swallow the neighbouring
      // "0 20" and produce a ten-digit string matching nothing.
      (UP.match(/\d+/g) || []).forEach(function (d) { _addRun(d, 'solid'); });
      (UP.match(/\d(?:[ \t]?\d){3,11}/g) || []).forEach(function (run) {
        _addRun(run.replace(/\D/g, ''), 'glued');
      });
      wholeRuns.some(function (d) {
        jHit = _tryNumber(d);
        if (jHit) _jSrc = _runSrc[d] || '';
        return !!jHit;
      });
      if (!jHit) {
        wholeRuns.some(function (d) {
          // ══ v0.9.1088 — two gates the repair badly needed ══════════════════
          // Brad's 6817 scraper flatcar: the reader never saw 6817. It read the
          // catalog page pinned to the WALL — 1015, 110, 108, 950 — all off-era,
          // all correctly rejected. Then this repair took 1015, a real prewar
          // transformer it had read PERFECTLY, changed one digit, landed on
          // 1615 in the stamped catalog, and called it confirmed. "Cannonball
          // Express Set", from a wall poster, presented as fact.
          //
          // Gate 1: never mutate a number that exists in ANY catalog. A token
          // that is a real item somewhere was almost certainly read correctly —
          // it is just not THIS item. Correcting a correct reading is
          // manufacturing evidence.
          if (fmAny && (fmAny(d) || (d.length > 4 && fmAny(d.slice(0, 4))))) return false;
          // Gate 2: four digits with one changed is three digits of evidence —
          // and with thousands of catalog numbers, some variant nearly always
          // lands on one. Five or more digits (5464475 \u2192 6464-475, the case
          // this was built for) is specific enough to trust.
          if (d.length < 5) return false;
          return _oneOffVariants(d).some(function (v) {
            var hit = _tryNumber(v);
            // v0.9.1305: a repair inherits its run's trustworthiness \u2014 a
            // solid run with one digit corrected is still a number that was
            // READ (5464475 \u2192 6464-475); only gluing makes it ASSEMBLED.
            if (hit) { jHit = hit; _jSrc = _runSrc[d] || ''; dbg.oneOff = d + ' \u2192 ' + hit; return true; }
            return false;
          });
        });
      }
    }
    var wHits = [];
    if (fm && !jHit && joined.length) {
      // v0.9.1093 (Brad's Summit car): the reader saw "12446" — 2446 with one
      // junk digit in front. The window search tried 1244 before 2446, both are
      // real postwar items, and the first won by position alone. Two windows of
      // one run both existing in the catalog is AMBIGUITY: all hits are
      // collected, exactly one confirms, several become a guess with the
      // choices offered as chips for a human to settle.
      joined.forEach(function (d) {
        if (wHits.length >= 4) return;
        // A BARE reassembled number must obey the same length ceiling as any
        // other; a DASH-REPAIRED one may exceed it (3562-1, 6464-475).
        // v0.9.1097: windows are reconstructions too — same no-set-rows check.
        if ((!digitCap || d.length <= digitCap) && fmJoin(d)) {
          if (wHits.indexOf(d) < 0) wHits.push(d);
          return;
        }
        for (var cut = 3; cut <= 4; cut++) {
          if (d.length <= cut) continue;
          var cand = d.slice(0, cut) + '-' + d.slice(cut);
          if (fmJoin(cand)) { if (wHits.indexOf(cand) < 0) wHits.push(cand); return; }
        }
      });
      if (wHits.length === 1) jHit = wHits[0];
    }
    dbg.joinTried = joined.slice(0, 10);
    if (jHit) dbg.joined = jHit;
    if (!jHit && wHits.length > 1) {
      dbg.windowAmbig = wHits.join(', ');
      // ══ v0.9.1105 — a number READ beats numbers GLUED (Brad's Modern 6817) ═
      // The windows assembled 38994 and 9475 from scattered digits, while the
      // car's own number — 6817, read twice, a real item in ANOTHER era's
      // catalog — sat parked as an off-era lead and never got its turn,
      // because the ambiguous-windows return fired first. A directly-read
      // off-era token now outranks reconstructions: the tag settles it when
      // the catalog quotes it (v0.9.1089), and otherwise it leads the pick —
      // Brad's own rule: "say its a modern 6817 or its a postwar 6817 and
      // let the user pick."
      var _offLead = null;
      if (fmAny && fm) {
        for (var oi = 0; oi < uniq.length; oi++) {
          var oc = uniq[oi];
          if (fm(oc)) continue;
          // v0.9.1167: same maker only. A number that exists solely in another
          // maker's catalog is not a lead the user asked for.
          var _oRow = fmAny(oc) || fmAny(oc.replace(/^\d-/, ''));
          if (_oRow && _sameMakerAsFilter(_oRow)) { _offLead = oc; break; }
        }
      }
      if (_offLead) {
        if (typeof _pinQuoteMatch === 'function') {
          var _qm3 = _pinQuoteMatch(_offLead, prefer);
          if (_qm3 && _qm3.row && _qm3.row.itemNum) {
            dbg.quoted = _offLead + ' \u2192 ' + _qm3.row.itemNum;
            return { num: String(_qm3.row.itemNum), matched: true, viaQuote: _offLead, dbg: dbg };
          }
        }
        dbg.offEraLead = _offLead;
        return { num: _offLead, matched: false, offEra: true,
                 alts: [String(_offLead)].concat(wHits.slice(0, 3)), dbg: dbg };
      }
      return { num: wHits[0], matched: false, alts: wHits.slice(0), dbg: dbg };
    }

    var digitsOf = function (x) { return String(x || '').replace(/\D/g, '').length; };
    // v0.9.1168: no letters anywhere = no reading happened. Report that, and keep
    // the reasoning on dbg so the disclosure expander can show what it saw.
    // (Deliberately not quoting the expander's wording here — a comment naming a
    // UI string gets counted as code by the tests that assert how many copies of
    // that string exist. Seventh time that class has bitten on 2026-07-30.)
    if (_noLetters && jHit && _jSrc === 'glued' && !direct && !dbg.viaMaker) {
      dbg.noLetters = String(jHit);
      return { num: '', matched: false, dbg: dbg };
    }
    if (direct || jHit) {
      // v0.9.1277 (Brad's 6561 cable reel car asserted as "1656 — 0-4-0 Steam
      // Locomotive"): the reject list had swallowed 6561 — the number stamped
      // TWICE beside LIONEL LINES, the strongest read in the photo — and the
      // window machinery then assembled 1656, an anagram of those same digits,
      // and stated it as fact. A reconstruction must never be asserted while a
      // maker-named direct read sits silenced on the reject list. Offer it as
      // a guess, and say out loud what the car itself reads.
      var _rejStrong = '';
      for (var _ri = 0; _ri < _rejSeen.length; _ri++) {
        if (namedByMaker[_rejSeen[_ri]]) { _rejStrong = _rejSeen[_ri]; break; }
      }
      if (_rejStrong && !direct && !dbg.viaMaker && jHit) {
        dbg.rejectedStrong = _rejStrong;
        return { num: jHit, matched: false, alts: [String(jHit)], dbg: dbg };
      }
      // Order of authority: what the maker stamped next to its own name, then
      // the more specific of a joined reconstruction and a direct hit. Length
      // only ever breaks a tie between those last two — it is meaningless
      // between two unrelated numbers, which is how a road number won earlier.
      //
      // v0.9.1305 (Brad's New Haven 232 asserted as "1241 — Transformer",
      // "i scanned a few times, its a 232"): longer-wins was built for a
      // fragment and the number that CONTAINS it — 621 losing to 3562-1,
      // the same digits on the same car. His 232 was read off the cab and
      // confirmed in the stamped catalog, then lost to 1241, a number WELDED
      // from scattered stray digits, purely for being one digit longer.
      // Length is meaningless between unrelated numbers — the road-number
      // lesson again. A joined reconstruction now outranks a direct catalog
      // hit only when the direct number is a digit-fragment of it, or when
      // the run was READ unbroken ('solid') rather than glued. "A number
      // READ beats numbers GLUED" (v0.9.1105) — applied to the one corner
      // that never got it.
      var _fragOfJoin = !!(direct && jHit &&
        String(jHit).replace(/\D/g, '').indexOf(String(direct).replace(/\D/g, '')) >= 0);
      var win;
      if (dbg.viaMaker && direct) win = direct;
      else if (jHit && digitsOf(jHit) > digitsOf(direct)
               && (!direct || _jSrc === 'solid' || _fragOfJoin)) win = jHit;
      else {
        win = direct || jHit;
        if (direct && jHit && win === direct && digitsOf(jHit) > digitsOf(direct)) {
          dbg.directOverJoin = String(direct) + ' (read) kept over ' + String(jHit) + ' (assembled)';
        }
      }
      // A number the maker named is trustworthy however little else was read —
      // "LIONEL 6176" is corroboration in itself.
      var solid = (evidence >= THIN) || !!dbg.viaMaker;
      // v0.9.1099 (Brad's 6175 asserted as "225 — Alco Diesel"): the same
      // photo yielded "4225", a four-digit run that matched nothing — strong
      // evidence the real number is LONGER than the three digits being
      // asserted. A short token cannot be stated as fact while a longer run
      // from the same photo went unexplained; it is offered instead.
      if (solid && win === direct && !jHit && !dbg.viaMaker
          && String(direct).replace(/\D/g, '').length <= 3
          && wholeRuns.some(function (dR) { return dR.replace(/\D/g, '').length >= 4; })) {
        dbg.longerUnexplained = wholeRuns[0];
        return { num: win, matched: false, alts: [String(win)], dbg: dbg };
      }
      // v0.9.1099b (Brad's Rio Grande 53 asserted as "988 — Railroad
      // Structure Set", then "213 — Alco Diesel" on re-scan; his 6175 as
      // "225"): with a few thousand catalog numbers, a stray three-digit
      // token lands on a real item too easily to be stated as FACT on one
      // sighting. Seen once → offered as a guess. Read twice or more in the
      // pooled text, or vouched for by the maker's name, it still confirms.
      if (solid && win === direct && !jHit && !dbg.viaMaker
          && String(direct).replace(/\D/g, '').length <= 3) {
        var _dD = String(direct).replace(/\D/g, '');
        var _frD = (UP.match(new RegExp('\\b' + _dD + '\\b', 'g')) || []).length;
        if (_frD < 2) {
          dbg.shortSolo = String(direct);
          return { num: win, matched: false, alts: [String(win)], dbg: dbg };
        }
      }
      // v0.9.1097 (Brad's era-less 3545 asserted as an ATLAS "2501"): with no
      // era stamped on the photo there is no particular catalog to check a
      // reconstruction against — the join found 2501 in a different maker's
      // list entirely and called it fact. A reconstruction validated against
      // "any catalog at all" is a guess; the direct token rides along as the
      // other chip so the user picks between what was actually seen.
      // Only a SHORT reconstruction that DIFFERS from the direct token is
      // demoted: 250+1 glued into 2501 is a coincidence waiting to happen,
      // while 5464475 dash-repaired into 6464-475 is seven digits of evidence,
      // and a jHit that merely re-found the direct token is no join at all.
      if (win === jHit && jHit && String(jHit) !== String(direct || '')
          && String(jHit).replace(/\D/g, '').length <= 5
          && (!prefer || !prefer.era) && !dbg.viaMaker) {
        var _altsJ = [String(jHit)];
        if (direct && String(direct) !== String(jHit)) _altsJ.push(String(direct));
        dbg.noEraJoin = true;
        return { num: win, matched: false, alts: _altsJ, dbg: dbg };
      }
      return { num: win, matched: solid, thin: !solid, dbg: dbg };
    }

    // Nothing in the stamped catalog. Before giving up, look in every catalog —
    // but a hit there is a LEAD, not a confirmation, because the whole reason we
    // are here is that the photo says it belongs somewhere else. This also
    // protects against the stamped era's data simply not being loaded.
    // v0.9.1099 (Brad's Santa Fe guessed "0000"): a token whose digits are
    // all zeros is smudge, not a number.
    uniq = uniq.filter(function (cZ) { return !/^0+$/.test(String(cZ).replace(/\D/g, '')); });
    var loose = fmAny
      ? uniq.filter(function (c) { return fmAny(c) || fmAny(c.replace(/^\d-/, '')); })
      : [];

    // 1b) v0.9.1065 — DASH REPAIR. The audit produced "6464475" twice and the
    // catalog rejected both, because the real number is 6464-475: OCR drops a
    // dash far more often than it invents a digit. Try putting one back at each
    // plausible split and see if the catalog then recognises it. Only an exact
    // catalog hit is accepted, so this can add answers but never invent them.
    if (fm) {
      var repaired = null;
      uniq.some(function (c) {
        if (c.indexOf('-') >= 0) return false;
        var d = c.replace(/\D/g, '');
        if (d.length < 5 || d.length > 8) return false;
        for (var cut = 3; cut <= 4 && !repaired; cut++) {
          if (d.length <= cut) continue;
          var cand = d.slice(0, cut) + '-' + d.slice(cut);
          if (fm(cand)) repaired = cand;
        }
        return !!repaired;
      });
      if (repaired) { dbg.repaired = repaired; return { num: repaired, matched: true, dbg: dbg }; }
    }
    // 1c) v0.9.1089 — an off-era number may be THIS era's reissue. A Modern-
    // stamped photo reading "6817" resolves to the Modern row whose description
    // quotes 6817. The tag settles it; an ambiguous quote does not.
    if (loose.length && typeof _pinQuoteMatch === 'function') {
      loose.sort(dashRank);
      for (var qi = 0; qi < loose.length; qi++) {
        var qm = _pinQuoteMatch(loose[qi], prefer);
        if (qm && qm.row && qm.row.itemNum) {
          dbg.quoted = qm.quoted + ' \u2192 ' + qm.row.itemNum;
          return { num: String(qm.row.itemNum), matched: true, viaQuote: qm.quoted, dbg: dbg };
        }
      }
    }
    // ══ v0.9.1168b — NOTHING LEGIBLE, SO NOTHING OFFERED (Brad's call) ═════
    // "Block it — blank beats wrong."
    //
    // Brad's MKT 0-8-0 came back "2233810 — AT&SF EMD F7 A-A Set", and the number
    // reached the card through THIS hedge: a token that merely looks catalog-shaped,
    // offered because it exists in some list. On a photo whose recovered text holds
    // not one letter, that is a coincidence dressed as a finding.
    //
    // This narrows v0.9.1067, and the distinction matters. That rule came from his
    // 2408 Santa Fe car — "saying still no clear number will piss people off when
    // the number is obviously to a user clear" — a photo where a HUMAN can read the
    // number and the reader could not. Such a car is covered in lettering, so the
    // recovered text has letters in it and this gate never fires. Text with NO
    // letters at all is the opposite situation: the reader saw nothing, and saying
    // so is the honest answer rather than an insult to the photographer.
    //
    // The confirmed paths above are untouched: a solid run with a misread digit
    // still repairs, a quote match still resolves, a maker-adjacent number still
    // counts. Only the unconfirmed HEDGE is withheld.
    // MY FIRST CUT OF THIS WAS ALSO WRONG, and Brad's own photos caught it again:
    // his Great Northern rotary snowplow is letterless too — "4 25 5 - -8 6 194 1
    // - - - 58 5 - 7 7 9 5 / 0 58 0 58" — and 58 IS the right answer. Blanking
    // every letterless hedge would have thrown that away.
    //
    // What separates them is REPETITION. 58 was read three times across the passes,
    // because it is genuinely painted on the car. 2233810 was seen once, and so was
    // 2500. With no lettering to corroborate anything, being seen more than once is
    // the only evidence available — so a token read a single time is not offered,
    // and one read repeatedly still is.
    if (_noLetters && loose.length) {
      var _seenTimes = function (c) {
        var d = String(c).replace(/[^0-9A-Za-z-]/g, '');
        if (!d) return 0;
        try {
          return (UP.match(new RegExp('(?:^|[^0-9])' + d.replace(/-/g, '\\-') + '(?:$|[^0-9])', 'g')) || []).length;
        } catch (eR) { return 0; }
      };
      var _repeated = loose.filter(function (c) { return _seenTimes(c) > 1; });
      if (!_repeated.length) { dbg.noLetters = String(loose[0]); loose = []; }
      else loose = _repeated;
    }
    // 2) nothing confirmed — offer the best catalog-shaped token as a hedge
    if (loose.length) { loose.sort(dashRank); return { num: loose[0], matched: false, offEra: true, dbg: dbg }; }
    uniq.sort(dashRank);
    if (uniq.length) {
      // v0.9.1098 (Brad's Great Northern 58): the card offered "194" — a
      // number in NO catalog — while the cab's 58, read twice, IS in the
      // stamped catalog. Backing beats length between two guesses. The
      // v0.9.1080 rule stands: a backed short is only offered here INSTEAD
      // of unbacked junk, never on its own.
      // When several backed shorts were seen (his card listed "25, 58"), the
      // one painted on the car shows up REPEATEDLY — 58 was read three times
      // across the passes, 25 once. Frequency picks.
      var shortBacked = null, _sbBest = 0;
      if (fm) (shortOnes || []).forEach(function (sB) {
        if (!fm(sB)) return;
        var _fr = (UP.match(new RegExp('\\b' + sB + '\\b', 'g')) || []).length;
        if (_fr > _sbBest) { _sbBest = _fr; shortBacked = sB; }
      });
      if (shortBacked) {
        dbg.shortBacked = shortBacked;
        return { num: shortBacked, matched: false, alts: [String(shortBacked), String(uniq[0])], dbg: dbg };
      }
      // v0.9.1168b: and the last-ditch offer is not exempt. On a letterless photo a
      // token in NO catalog, seen once, is the weakest thing this function can
      // produce — exactly the case Brad asked to come back blank.
      if (_noLetters) { dbg.noLetters = String(uniq[0]); return { num: '', matched: false, dbg: dbg }; }
      return { num: uniq[0], matched: false, dbg: dbg };
    }
    // 3) last resort: a catalog-backed short number, always as a guess
    // v0.9.1080 — a bare two-digit number is never offered on its own any more.
    //
    // Brad's Santa Fe 2414 offered "71"; his 1877 horse car offered "53". Both
    // came out of text containing no readable word, and both numbers exist in
    // the postwar catalog — which is precisely why they surfaced. I first tried
    // gating this on how much text was recovered, and it does not work: that
    // Santa Fe string has thirty characters in it, they are simply meaningless.
    // Length was measuring the wrong thing.
    //
    // The rule that does hold is about evidence, not volume: two digits alone
    // are never enough. With a few thousand numbers in the catalog, almost any
    // stray pair lands on one. A short number is only ever accepted when
    // something else vouches for it — the maker's name stamped beside it, which
    // promotes it to a full candidate above, or a description match. Otherwise
    // the honest answer is nothing, and nothing is what the user gets.
    dbg.shortDropped = shortOnes.slice(0, 3);
    // v0.9.1072 — a read that finds NOTHING is the case most worth explaining,
    // and it was the only one that explained nothing. Brad's Lionel 50 gang car
    // has the clearest lettering of any photo in his inbox and came back blank,
    // with no way to see whether "50" was read and rejected, read and discarded
    // as too short, or never read at all. Thirty-eight of his seventy-three
    // photos are in this state. Return the reasoning with an empty answer.
    return { num: '', matched: false, empty: true, dbg: dbg };
  }

  // Read any barcode on the photo and resolve it with the SAME brain the
  // Add-wizard scanner uses (window._barcodeDebug.decodeBarcode): it decodes a
  // Lionel UPC via the maker prefix + code and looks up the real catalog item.
  // So a modern retail UPC (e.g. 0-23922-… on a Thomas set) resolves to the
  // correct item instead of a stray number the OCR might grab.
  // v0.9.1136: every barcode this resolved used to be thrown away. The Photo
  // Inbox is the highest-volume identification surface in the app and it
  // contributed ZERO pairings — rrBcMapLearn was called only from the wizard
  // scanner (barcode.js:838 and :2864), never from here.
  //
  // _bcLearn records the pairing without blocking the read. rrBcMapLearn is
  // fail-quiet, dedupes against what this device already knows before touching
  // the sheet, and dedupes again in the community queue, so calling it on every
  // photo of the same box is cheap after the first.
  //
  // The `notInMaster` case is learned too, and is the MOST valuable one — it is
  // literally what Brad asked for when this was built: "make sure when users
  // take a pic with a barcode and enter an item that we don't have in the
  // master it submits through our community share deal to our sheet". It is
  // still not RETURNED as a read, because a number the catalog doesn't know
  // can't fill in an item — but the pairing is worth having.
  function _bcLearn(rawValue, itemNum, mfr, inMaster) {
    try {
      if (typeof rrBcMapLearn !== 'function') return;
      Promise.resolve(rrBcMapLearn(rawValue, itemNum, mfr || '', 'photo-inbox', inMaster))
        .catch(function () {});   // never let a pairing failure disturb a read
    } catch (e) {}
  }

  async function _readBarcode(blob) {
    if (!('BarcodeDetector' in window)) return null;
    var decode = (window._barcodeDebug && window._barcodeDebug.decodeBarcode) || null;
    try {
      var det = new window.BarcodeDetector();
      var bmp = await createImageBitmap(blob);
      var codes = await det.detect(bmp);
      if (bmp.close) bmp.close();
      var fm = (typeof findMaster === 'function') ? findMaster : null;
      for (var i = 0; i < (codes || []).length; i++) {
        var rv = String(codes[i].rawValue || '');
        var fmt = String(codes[i].format || '');
        if (!rv) continue;
        // Primary: the app's real UPC resolver (shared with the wizard scanner).
        if (decode) {
          try {
            var r = await decode({ rawValue: rv, format: fmt }, '');
            if (r && r.itemNum) {
              var known = !!(r.masterItem && !r.notInMaster);
              _bcLearn(rv, r.itemNum, r.manufacturer, known);
              if (known) return { num: r.itemNum, matched: true };
            }
          } catch (eD) {}
        }
        // Fallback: a barcode whose value IS a catalog number.
        var t = rv.replace(/\D/g, '');
        if (fm && fm(rv)) { _bcLearn(rv, rv, '', true); return { num: rv, matched: true }; }
        if (fm && t.length >= 3 && t.length <= 7 && fm(t)) { _bcLearn(rv, t, '', true); return { num: t, matched: true }; }
      }
    } catch (e) {}
    return null;
  }

  // ══ v0.9.1077 — identify by what the car SAYS, not just its number ═══════
  // Brad: "can we use description to help find some of these. ballast tamper
  // would work or road name may help." He is right, and his own photos make the
  // case better than any argument: a BALLAST TAMPER whose number never read, a
  // TIE-JECTOR, a gondola lettered NYC, a GP9 where the reader recovered
  // "MINNEAPOLIS ST LOUIS" perfectly and then fumbled 2348 into 2388.
  //
  // On most Lionel rolling stock the road name and the item's own name are the
  // LARGEST text on the model, and the catalog number is the smallest. We have
  // been reading the easy part and discarding it.
  //
  // This is deliberately conservative. It only speaks when the numbers have
  // failed, it only counts DISTINCTIVE words (a word shared by four hundred
  // catalog rows tells you nothing), it requires a clear winner rather than a
  // narrow one, and it never claims to be certain — it hands back a candidate
  // with the item named, so a glance confirms or kills it.
  // ══ v0.9.1089 — the tag settles it (Brad's rule, verbatim) ═══════════════
  // His 6817 scraper car carries the PW roundel: it is the modern Celebration
  // Series remake, correctly tagged Modern. The number painted on it — 6817 —
  // is the POSTWAR number, so a perfect read is off-era for its own photo.
  // Brad: "the fallback could be to say its a modern 6817 or its a postwar
  // 6817 and let the user pick. but if its already tagged modern, then that
  // should settle it."
  //
  // The catalog already contains the bridge: Lionel's reissue rows quote the
  // original number in their own descriptions — 6-39457 reads Postwar "6175"
  // Flatcar with rocket. So: index every number QUOTED in an era's
  // descriptions, and when a read lands on a number that is off-era for the
  // stamped photo, the row in the stamped catalog that quotes it is the
  // answer. Only an unambiguous quote settles it — two candidate rows means
  // the user picks, same as before.
  var _quoteIdx = null, _quoteIdxKey = '', _quoteIdxMap = null;
  function _quoteIndexFor(era) {
    var srcMap = null;
    try { srcMap = (window.state && state.masterByItem) || null; } catch (e0) {}
    if (!srcMap || !srcMap.forEach || !era) return null;
    if (_quoteIdx && _quoteIdxKey === era && _quoteIdxMap === srcMap) return _quoteIdx;
    var idx = {};
    try {
      srcMap.forEach(function (rows) {
        (rows || []).forEach(function (row) {
          if (!row || row._era !== era) return;
          // v0.9.1094: set descriptions quote their members' numbers. Letting
          // them into this index would "settle" an off-era read onto a SET
          // number — exactly what Brad flagged ("why are we matching to set
          // item numbers"). Only item rows may quote.
          if (_pinIsSetRow(row)) return;
          var toks = String(row.description || '').match(/\d[\dA-Za-z]*(?:-[\dA-Za-z]+)*/g) || [];
          var seen = {};
          toks.forEach(function (t) {
            t = t.replace(/^-+|-+$/g, '');
            if (t.length < 3 || t.length > 8) return;
            if (/^(?:19|20)\d{2}$/.test(t)) return;          // a year, not a number
            if (t === String(row.itemNum)) return;            // its own number
            if (seen[t]) return;
            seen[t] = 1;
            (idx[t] || (idx[t] = [])).push(row);
          });
        });
      });
    } catch (e) { return null; }
    _quoteIdx = idx; _quoteIdxKey = era; _quoteIdxMap = srcMap;
    return idx;
  }
  // ══ v0.9.1165 — WHICH ERAS IS THE USER FILTERED TO? ══════════════════════
  // A single-era filter covers one. A chip filter like "Lionel / O Gauge / Any
  // Era" covers several — Postwar and MPC/Modern — and rrActiveFilter names them
  // all as of this version. Every consumer below used to demand ONE era key and
  // return early on '', so under "Any Era" the number rescue, the quote rescue
  // and the word rescue were ALL switched off. That is the state Brad was
  // actually sitting in when his M-K-T read kept an MTH number: the correct
  // answer, 2631200, was sitting in the read's own saved text and nothing was
  // allowed to look for it.
  //
  // The unfinished half of v0.9.1157 — that version taught the resolver to
  // DESCRIBE a multi-era filter and never taught these consumers to USE one.
  function _prefEras(prefer) {
    if (!prefer) return [];
    if (prefer.eras && prefer.eras.length) return prefer.eras;
    return prefer.era ? [prefer.era] : [];
  }

  function _pinQuoteMatch(num, prefer) {
    var eras = _prefEras(prefer);
    if (!num || !eras.length) return null;
    // Try each era the filter covers; the FIRST unambiguous hit wins, and an
    // ambiguous one still means the user picks.
    for (var i = 0; i < eras.length; i++) {
      var idx = _quoteIndexFor(eras[i]);
      if (!idx) continue;
      var rows = idx[String(num).trim()];
      if (rows && rows.length === 1) return { row: rows[0], quoted: String(num).trim() };
    }
    return null;
  }

  var _descIdx = null, _descIdxKey = '', _descIdxMap = null;

  // ══ v0.9.1094 — is this catalog row a SET? ═══════════════════════════════
  // One shared answer. v0.9.1093 taught the number validator that text scraped
  // off a photo must not confirm against set rows; this session's Ballast
  // Tamper taught the WORD index the same lesson, so the rule lives in one
  // place and every index asks the same question.
  function _pinIsSetRow(row) {
    if (!row) return false;
    if (/\bsets?\b/i.test(String(row._tab || ''))) return true;
    if (/\bset\b/i.test(String(row.itemType || ''))) return true;
    return false;
  }

  // Words that appear on half the catalog and identify nothing.
  var _DESC_STOP = {
    LIONEL:1, LINES:1, BUILT:1, BLT:1, BY:1, THE:1, AND:1, FOR:1, WITH:1, AND1:1,
    CAR:1, CARS:1, RAILROAD:1, RAILWAY:1, RY:1, RR:1, CO:1, INC:1, NEW:1, TYPE:1,
    CAPY:1, LMT:1, WT:1, CUFT:1, CU:1, FT:1, LD:1, LT:1, NUMBER:1, NO:1, SET:1,
    GAUGE:1, SCALE:1, MODEL:1, TRAIN:1, ITEM:1, PART:1, USA:1, MADE:1, ONE:1,
    // v0.9.1093 (Brad's Clifton): OCR noise produced "SEE" and "ERROR", which
    // matched a row whose description is an ERRATA NOTE imported into the
    // master as if it were an item ("Appears to be an error since O Gauge
    // track is shown - see revised form below"). Rare-in-the-catalog is not
    // the same as identifying — catalog-note vocabulary never names a train.
    SEE:1, ERROR:1, NOTE:1, NOTES:1, REVISED:1, FORM:1, BELOW:1, ABOVE:1,
    SHOWN:1, APPEARS:1, SINCE:1, ALSO:1, SAME:1, ONLY:1, EACH:1, FROM:1,
    TRACK:1, PAGE:1, CATALOG:1, VERSION:1, VARIATION:1,
  };

  function _descTokens(str) {
    return String(str || '').toUpperCase().match(/[A-Z][A-Z&.-]{1,}/g) || [];
  }

  // One inverted index per era: WORD -> [rows]. Built once, on first use.
  function _descIndexFor(eras) {
    // v0.9.1165: an ERA LIST, so a multi-era chip filter has an index too.
    eras = Array.isArray(eras) ? eras : (eras ? [eras] : []);
    var eraKey = eras.join('|');
    // v0.9.1077d: this was cached on the era alone, so once built it survived
    // the catalog itself changing — a stale index that answers confidently is
    // worse than no index. The size of the loaded master is a cheap proxy for
    // "the data underneath me changed"; caught by a test where two different
    // catalogs shared an era and the second silently got the first's answers.
    var srcMap = null;
    try { srcMap = (window.state && state.masterByItem) || null; } catch (e0) {}
    // Identity of the actual Map, not a count of it. A first attempt keyed on
    // era + size, and a test with two different single-row catalogs got the
    // first one's answer for the second — a stale index that answers with
    // confidence is worse than having no index at all.
    if (_descIdx && _descIdxKey === eraKey && _descIdxMap === srcMap) return _descIdx;
    var idx = {};
    try {
      var m = srcMap;
      if (!m || !m.forEach) return null;
      m.forEach(function (rows) {
        (rows || []).forEach(function (row) {
          if (!row || (eras.length && eras.indexOf(row._era) < 0)) return;
          // v0.9.1094 (Brad's Ballast Tamper, "138 — Water Tower"): a set's
          // description NAMES its member cars, so every member name also hit
          // the set rows, tied the score, and the matcher refused to pick.
          // The words painted on a car identify an ITEM; sets answer nothing.
          if (_pinIsSetRow(row)) return;
          // v0.9.1099 (the same Ballast Tamper, still "138"): the master also
          // carries the item's BOX and its INSTRUCTION SHEET as rows, each
          // wearing the item's own name — so the item TIED with its own
          // paperwork and the matcher called it ambiguous. Paper rows
          // duplicate item names by design; they cannot vote here. (Number
          // validation is untouched — a number on a box lid is real.)
          if (/\b(box|boxes|paper|instruction|catalog|catalogs|service|science|construction|companions|other)\b/i
              .test(String(row._tab || ''))) return;
          var words = {};
          _descTokens([row.description, row.roadName, row.itemType].filter(Boolean).join(' '))
            .forEach(function (w) {
              w = w.replace(/[.&-]+$/, '');
              if (w.length < 3 || _DESC_STOP[w]) return;
              words[w] = 1;
            });
          Object.keys(words).forEach(function (w) {
            (idx[w] || (idx[w] = [])).push(row);
          });
        });
      });
    } catch (e) { return null; }
    _descIdx = idx; _descIdxKey = eraKey; _descIdxMap = srcMap;
    return idx;
  }

  // Returns { row, score, words } or null.
  function _pinDescMatch(text, prefer) {
    // v0.9.1165: every era the filter covers, not just a single key.
    var eras = _prefEras(prefer);
    if (!eras.length) return null;            // without a catalog to search, don't guess
    var idx = _descIndexFor(eras);
    if (!idx) return null;
    var seen = {}, words = [];
    _descTokens(text).forEach(function (w) {
      w = w.replace(/[.&-]+$/, '');
      if (w.length < 3 || _DESC_STOP[w] || seen[w]) return;
      seen[w] = 1; words.push(w);
    });
    if (!words.length) return null;

    // v0.9.1077c — OCR breaks long words. Brad's Lackawanna Train Master came
    // through as "LACKAWAN NA", so an exact-word index found nothing at all. A
    // photo word of six or more characters also matches a catalog word that
    // begins with it (or that begins with the photo word) — long enough that a
    // prefix collision is not a coincidence, and it is exactly how OCR fails on
    // the longest and most identifying words on a model.
    var idxKeys = null;
    function _rowsFor(w) {
      if (idx[w]) return idx[w];
      if (w.length < 6) return null;
      if (!idxKeys) idxKeys = Object.keys(idx);
      var out = null;
      for (var i = 0; i < idxKeys.length; i++) {
        var k = idxKeys[i];
        if (k.length < 6) continue;
        if (k.indexOf(w) === 0 || w.indexOf(k) === 0) {
          out = (out || []).concat(idx[k]);
        }
      }
      return out;
    }

    var score = {}, hitWords = {}, rowOf = {};
    words.forEach(function (w) {
      var rows = _rowsFor(w);
      if (!rows || !rows.length) return;
      // A word carrying 40+ rows is a category, not an identity. Weight by how
      // rare it is — TIE-JECTOR is worth far more than GONDOLA.
      var weight = rows.length > 60 ? 0 : (rows.length > 12 ? 0.4 : (rows.length > 3 ? 1 : 2));
      if (!weight) return;
      // v0.9.1080b: dedupe rows within one word. Prefix matching can return the
      // same row from several index keys, and it was scoring each one — which is
      // how a single word "MAIL" counted three times on Brad's Western &
      // Atlantic mail car and pulled up a completely different boxcar.
      var seenRow = {};
      rows.forEach(function (row) {
        var k = String(row.itemNum || '') + '|' + String(row._tab || '');
        if (seenRow[k]) return;
        seenRow[k] = 1;
        score[k] = (score[k] || 0) + weight;
        (hitWords[k] || (hitWords[k] = [])).push(w);
        rowOf[k] = row;
      });
    });
    var keys = Object.keys(score);
    if (!keys.length) return null;
    keys.sort(function (a, b) { return score[b] - score[a]; });
    var top = score[keys[0]], second = keys.length > 1 ? score[keys[1]] : 0;
    // Needs to be worth something AND to be a clear winner. A near tie means the
    // words were generic and any of a dozen items would fit.
    // Two DISTINCT words minimum. "MAIL" on its own describes a mail car, a mail
    // boxcar and a mail crane equally well; "WESTERN" plus "ATLANTIC" describes
    // one train. A single word is a category, not an identity — and the whole
    // promise of this route is that a glance can confirm it, which only holds
    // when it had real evidence to begin with.
    // ...unless the single word is long AND essentially unique. TIE-JECTOR and
    // LACKAWANNA each name exactly one item in the catalog and are far too long
    // to collide by accident; MAIL is short and describes half a dozen cars.
    // Rarity and length are what separate a name from a category, not count.
    var w0 = (hitWords[keys[0]] || []);
    if (w0.length < 2) {
      var only = w0[0] || '';
      var rowsFor0 = only ? (_rowsFor(only) || []) : [];
      var nearUnique = rowsFor0.length && rowsFor0.length <= 2;
      // v0.9.1164 — a PUNCTUATED ROAD ABBREVIATION is an identity even when it
      // is short. Brad's M-K-T Legacy 0-8-0 turned on exactly this: 'M-K-T'
      // names ONE row among 23,236 Lionel-modern rows — a fingerprint — but it
      // is five characters, so the seven-character rule discarded the only
      // identifying word in the sentence and this returned nothing at all.
      // B&O, C&O, M-K-T, D&RGW, L&N, T&P: the most identifying text on a model
      // is often the shortest. The punctuation is what keeps ordinary short
      // words out — and near-uniqueness still has to hold, so a common
      // abbreviation cannot walk in on its shape alone.
      var isRoadAbbrev = only.length >= 3 && /[&.-]/.test(only);
      if (!(nearUnique && (only.length >= 7 || isRoadAbbrev))) return null;
    }
    // v0.9.1093: the matched words together must carry real substance — nine
    // characters of distinct matched text. FORT+KNOX+RESERVE is fifteen,
    // MINNEAPOLIS alone is eleven; two scraps of OCR noise that happen to be
    // rare in the catalog do not add up to a name.
    // Applies to MULTI-word matches only: a single word already passed the
    // stricter lone-word rule above (seven-plus characters, at most two rows),
    // which is how LACKAWAN — eight characters, one item — stays a match while
    // SEE+ERROR — eight characters of catalog-note noise — does not.
    var _wchars = 0;
    (hitWords[keys[0]] || []).forEach(function (wd) { _wchars += String(wd).length; });
    if ((hitWords[keys[0]] || []).length >= 2 && _wchars < 9) return null;
    if (top < 2) return null;
    if (second >= top * 0.75) return null;
    // v0.9.1166: does the winning match rest on a word that names one or two rows
    // in the whole era — a herald, a road abbreviation, a model name? That is a
    // fingerprint, and _pinDescArbitrate needs to know, because a fingerprint is
    // strong enough to contradict a number that merely EXISTS in the catalog.
    var _nearUnique = false;
    (hitWords[keys[0]] || []).forEach(function (wd) {
      var rs = _rowsFor(wd);
      if (rs && rs.length && rs.length <= 2) _nearUnique = true;
    });
    return { row: rowOf[keys[0]], score: top, nearUnique: _nearUnique,
             words: (hitWords[keys[0]] || []).slice(0, 6) };
  }

  // ══ v0.9.1069 — best of several passes ═══════════════════════════════════
  // The audit settled this. No single setting wins: tiling alone found Brad's
  // 6817, 6801, 2410 and 6828, and missed his Fort Knox 6445 — which INVERTED
  // caught. Counting rows where any setting confirmed a number gives 45 of 73
  // against the best single column's 40. Reading once and accepting the answer
  // was leaving a fifth of the inbox on the floor.
  //
  // So: try the strongest first and stop the moment the stamped catalog
  // confirms a number. Most photos still cost one pass; only the awkward ones
  // pay for the rest.
  //
  //   1  TILED   — the number is usually the SMALLEST text on the item, dwarfed
  //                by the road name. Reading each third blown up is what makes
  //                it legible, and it beat every other setting by a wide margin.
  //   2  INVERTED— light lettering on a dark body. Tesseract expects the
  //                opposite, and half of Lionel's rolling stock is the wrong way
  //                round for it.
  //   3  DIGITS  — no letters at all, so it cannot offer O for 0 or S for 5.
  //   5  STAMP   — v0.9.1095, the white-stamp pass. White serif numbers on
  //                saturated plastic (Brad's red 3512, blue 6017) melt into
  //                gray under luma conversion. min(R,G,B) is a whiteness
  //                detector: white stays bright, ANY strongly coloured body
  //                goes dark. Six overlapping close-up cells from the middle
  //                and bottom thirds (wall clutter lives in the top third)
  //                stacked into one sheet, read once in sparse-text mode.
  //                Runs last — it can only add reads, never lose one.
  var _FREE_PASSES = [
    { mode: 'sharp',  tiles: 3, wl: 'full'   },
    { mode: 'invert', tiles: 0, wl: 'full'   },
    { mode: 'sharp',  tiles: 0, wl: 'digits' },
    { mode: 'chan',   tiles: 3, wl: 'full'   },
    { mode: 'stamp',  tiles: 0, wl: 'digits' },
  ];
  var _WL_FULL = '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  var _WL_DIGITS = '0123456789-';

  async function _freeReadBlob(blob, maxDim, prefer) {
    var bc = await _readBarcode(blob);
    if (bc) return bc;
    var w = await _tessGet(); if (!w) return null;
    var bmp = null;
    try { bmp = await createImageBitmap(blob); }
    catch (eB) {
      // A photo the browser cannot decode is a real answer, not a crash.
      console.warn('[inbox] could not decode this photo', eB && eB.message);
      return { num: '', matched: false, empty: true,
               dbg: { era: (prefer && prefer.era) || '', eras: _prefEras(prefer), cand: [], inEra: [], offEra: [],
                      note: 'the browser could not decode this photo' } };
    }
    var dim = maxDim || 2400;
    var _photoCols = _pinPhotoColors(bmp);   // v0.9.1101: before the bitmap closes
    var best = null, text = '', stampSaw = '', textAll = '';
    for (var pi = 0; pi < _FREE_PASSES.length; pi++) {
      var p = _FREE_PASSES[pi];
      var t = '', r = null;
      try {
        await w.setParameters({ tessedit_char_whitelist: p.wl === 'digits' ? _WL_DIGITS : _WL_FULL });
        if (p.mode === 'stamp') {
          // v0.9.1098 — the stamp pass reads TWO ways, from a nine-car lab
          // bench built on Brad's own photos. Sparse mode ('11') on the
          // stacked sheet catches the larger stamps (3512, 6017, 3428). The
          // small ones — 6816, 6175 — read ONLY in block mode ('6') at high
          // zoom, and block mode assumes ONE uniform block, so it gets one
          // close-up cell at a time, never the stack. Block mode is also the
          // shipping default since v0.9.1065, so the worker is left in the
          // right state for the other passes.
          try { await w.setParameters({ tessedit_pageseg_mode: '11' }); } catch (ePs) {}
          t = (((await w.recognize(_stampSheet(bmp, dim))).data) || {}).text || '';
          try { await w.setParameters({ tessedit_pageseg_mode: '6' }); } catch (ePr) {}
          r = _numberFromText(t, prefer);
          if (!(r && r.matched && r.num)) {
            var _cells = _stampCells(bmp, dim);
            for (var ci = 0; ci < _cells.length; ci++) {
              var ct = '';
              try { ct = (((await w.recognize(_cells[ci])).data) || {}).text || ''; } catch (eC2) { continue; }
              if (!ct.trim()) continue;
              t += '\n' + ct;
              var rC = _numberFromText(t, prefer);
              if (rC) r = rC;
              // The moment an in-era four-digit number confirms, stop paying.
              if (r && r.matched && r.num && String(r.num).replace(/\D/g, '').length >= 4) break;
            }
          }
          stampSaw = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 140);
          if (r && r.dbg) {
            r.dbg.stampPass = true;
            if (!r.dbg.note) r.dbg.note = 'found by the light-numbers-on-a-coloured-body pass';
          }
        } else if (p.tiles) {
          // v0.9.1076 — WHERE the text was found matters. Brad photographs his
          // shelf against a wall with a printed catalog page pinned to it, and
          // the reader was lifting numbers straight off it: a 6816 flatcar came
          // back "409" and a 6817 came back "6912", neither number anywhere on
          // the model. Background print is often CRISPER than stamped lettering,
          // so it wins on merit and is wrong every time.
          //
          // The item is in the middle of the frame; the wall is above it. So the
          // middle band gets asked first and on its own — if that alone yields a
          // catalog-confirmed number, nothing from the edges can overrule it.
          var bands = [];
          for (var ti = 0; ti < p.tiles; ti++) {
            bands.push((((await w.recognize(_auditTile(bmp, dim, p.mode, ti, p.tiles))).data) || {}).text || '');
          }
          var mid = bands[Math.floor(p.tiles / 2)] || '';
          var rMid = _numberFromText(mid, prefer);
          if (rMid && rMid.matched && rMid.num) {
            if (rMid.dbg) rMid.dbg.fromMiddle = true;
            r = rMid; t = mid;
          } else {
            t = ((((await w.recognize(_auditCanvas(bmp, dim, p.mode))).data) || {}).text || '')
              + '\n' + bands.join('\n');
            var rAll = _numberFromText(t, prefer);
            // v0.9.1093 (Brad's 6816: "1043 — Transformer", read straight off
            // the catalog page pinned to the wall). The item sits in the middle
            // of the frame; a confirmed number whose digits never appear in the
            // middle band was found at the EDGE — the shelf above, the wall
            // behind — and is demoted to a guess rather than stated as fact.
            if (rAll && rAll.matched && rAll.num) {
              var _digits = String(rAll.num).replace(/\D/g, '');
              var _midDigits = mid.replace(/\D/g, '');
              if (_digits && _midDigits.indexOf(_digits) < 0 && !(rAll.dbg && rAll.dbg.viaMaker)) {
                rAll.matched = false;
                if (rAll.dbg) rAll.dbg.edgeOnly = true;
              }
            }
            if (rAll) { r = rAll; }
          }
        } else {
          t = (((await w.recognize(_auditCanvas(bmp, dim, p.mode))).data) || {}).text || '';
        }
      } catch (eP) { continue; }
      if (!r) r = _numberFromText(t, prefer);
      // An empty answer still carries its reasoning, so keep it if nothing
      // better turns up — but never let it outrank a real one.
      if (t) textAll += (textAll ? '\n' : '') + t;
      if (r && (!best || (r.num && !best.num) || (r.matched && !best.matched))) { best = r; text = t; }
      // v0.9.1096 (Brad's 6175 read as "225", his 3545 as "250"): a later pass
      // that confirms a LONGER in-era number than an early short confirm is a
      // disagreement, not a refinement — the longer number leads, both are
      // offered as chips, and neither is asserted as fact.
      else if (r && r.matched && r.num && best && best.matched && best.num
               && String(r.num) !== String(best.num)
               && String(r.num).replace(/\D/g, '').length > String(best.num).replace(/\D/g, '').length) {
        var _shortN = String(best.num);
        r.matched = false;
        r.alts = [String(r.num), _shortN];
        if (r.dbg) r.dbg.shortVsLong = _shortN + ' vs ' + r.num;
        best = r; text = t;
      }
      // The early exit is earned by evidence, not by any confirm: four or more
      // digits, or the maker's name standing next to the number. A bare
      // 1-3 digit confirm is exactly what 225 and 250 were — real catalog
      // items scraped off the wrong part of the frame — so the remaining
      // passes (above all the white-stamp pass) still get their turn.
      if (best && best.matched && best.num
          && (String(best.num).replace(/\D/g, '').length >= 4
              || (best.dbg && best.dbg.viaMaker))) break;
    }
    try { await w.setParameters({ tessedit_char_whitelist: _WL_FULL }); } catch (eR) {}
    // ── v0.9.1099 — the passes compare notes ──────────────────────────────
    // Brad's Great Northern: pass texts held "58" three times, but each pass
    // ranked only its own text, so "25" (once) tied it and won by order. His
    // Santa Fe 2408: an early pass guessed "0000" while the stamp pass
    // plainly read 2408 — and lost the slot. When no pass confirmed, one
    // final read of the POOLED text decides: it sees every number every pass
    // saw, so frequency and backing are judged on the whole evidence.
    try {
      if (textAll && !(best && best.matched)) {
        var rPool = _numberFromText(textAll, prefer);
        if (rPool && rPool.num) {
          if (rPool.dbg) rPool.dbg.pooled = true;
          best = rPool; text = textAll;
        }
      }
    } catch (ePool) {}
    // What the stamp pass saw survives into the disclosure even when it lost —
    // the next failure report then shows what it read instead of a blank.
    try { if (best && best.dbg && stampSaw && !best.dbg.stampPass) best.dbg.stampSaw = stampSaw; } catch (eSS) {}
    try { if (bmp.close) bmp.close(); } catch (eC) {}
    // ── What does the car SAY? ────────────────────────────────────────────
    // v0.9.1099: the words are matched against the POOLED text of every pass
    // — a name half-read by one pass is often completed by another.
    try { best = _pinDescArbitrate(best, textAll || text, prefer); }
    catch (eD) { console.warn('[inbox] description match failed', eD && eD.message); }
    var out = best;
    // ── v0.9.1101 — the color veto ────────────────────────────────────────
    try {
      if (out && out.num && _photoCols) {
        var _rowsC = null;
        try {
          var _mbi = window.state && state.masterByItem;
          if (_mbi && _mbi.get) _rowsC = _mbi.get(String(out.num)) || null;
        } catch (eM) {}
        if ((!_rowsC || !_rowsC.length) && typeof findMaster === 'function') {
          var _r1 = findMaster(out.num, null, prefer || null);
          if (_r1) _rowsC = [_r1];
        }
        var _clash = _pinColorClash(_photoCols, _rowsC);
        if (_clash) {
          if (out.dbg) { out.dbg.colorClash = _clash; out.dbg.photoColors = _photoCols.join(', '); }
          if (out.matched) out.matched = false;
        }
      }
    } catch (eCC) {}
    // v0.9.1068 (Brad: "where does 120 come from?"). A number appears with no
    // way to tell whether the reader saw it on the item, on the shelf behind it,
    // or invented it from a shadow. Keep the words it actually read.
    if (out) out.raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    return out;
  }

  // ══ What the car SAYS versus what the number claims ══════════════════════
  // v0.9.1077b — this used to run only when the numbers had failed outright,
  // and Brad's Lackawanna 2321 showed why that is not enough. The reader saw
  // "D321" — 2321 with the leading 2 misread — and 321 IS a real postwar item,
  // a Trestle Bridge. So a wrong answer counted as a match and the word
  // LACKAWAN, sitting in the same text and naming the locomotive outright,
  // was never consulted. It runs every time now.
  // v0.9.1094 — pulled out of _freeReadBlob so the harness can call it with
  // Brad's exact scraped text; the v0.9.1085 lesson is that node --check
  // cannot catch what only a CALL can.
  function _pinDescArbitrate(best, text, prefer) {
    {
      var dm = _pinDescMatch(text, prefer);
      if (dm && dm.row && dm.row.itemNum) {
        var descNum = String(dm.row.itemNum);
        var haveNum = (best && best.num) ? String(best.num) : '';
        var descOf = [dm.row.description, dm.row.roadName].filter(Boolean)
          .filter(function (v, i, a) { return a.findIndex(function (x) { return String(x).toLowerCase() === String(v).toLowerCase(); }) === i; })
          .join(' \u2014 ');
        var dbg2 = (best && best.dbg) || {};
        dbg2.viaDesc = dm.words.join(', ');

        // TWO WEAK SIGNALS THAT AGREE. "321" is the tail of "2321", and the
        // lettering independently says Lackawanna. A misread leading digit and a
        // road name pointing at the same item is far stronger evidence than
        // either alone — this is the case worth being confident about.
        var tailAgrees = haveNum && descNum !== haveNum &&
          (descNum.replace(/\D/g, '').slice(-haveNum.replace(/\D/g, '').length) === haveNum.replace(/\D/g, ''));

        if (tailAgrees) {
          dbg2.corroborated = descNum + ' (read ' + haveNum + ', lettering agrees)';
          best = { num: descNum, matched: true, viaDesc: true, descWords: dm.words, descOf: descOf, dbg: dbg2 };
        } else if (!best || !best.matched) {
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf, dbg: dbg2,
                   disagreed: (haveNum && haveNum !== descNum) ? haveNum : '' };
        } else if (dm.score >= 3 && haveNum.replace(/\D/g, '').length <= 3) {
          // A confident name beats a three-digit number that could be anything.
          // Offered rather than asserted, since the two genuinely disagree.
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf,
                   disagreed: haveNum, dbg: dbg2 };
        } else if (dm.nearUnique) {
          // v0.9.1166 — Brad's M-K-T steam locomotive was read as "2900 — Lockon",
          // a track accessory, and offered as a confident answer. 2900 IS a real
          // Lionel number, so best.matched was true, and the only branch that
          // could overturn a matched number demanded a score of 3+ AND no more
          // than three digits. A FOUR-digit number that merely exists therefore
          // outranked the herald painted on the car — and that herald, M-K-T,
          // names exactly ONE row among 23,236 Lionel-modern rows.
          //
          // A fingerprint word now contradicts a matched number whatever its
          // length. NEITHER side is asserted: the name leads because it is
          // physically on the item, the number rides along as `disagreed`, and
          // the card shows both for the user to settle.
          dbg2.nameVsNumber = descNum + ' (the lettering on the item) vs '
            + haveNum + ' (the number read)';
          // When the two answers are not even the same KIND of thing — a track
          // accessory against a locomotive — say so. That is the part a person
          // settles at a glance, and it is exactly what was missing from the
          // Lockon card.
          try {
            var _rowNum = (typeof findMaster === 'function') ? findMaster(haveNum, null, prefer) : null;
            var _tA = _rowNum ? String(_rowNum.itemType || '').trim() : '';
            var _tB = String(dm.row.itemType || '').trim();
            if (_tA && _tB && _tA.toLowerCase() !== _tB.toLowerCase()) {
              dbg2.typeClash = haveNum + ' is a ' + _tA + ', but the lettering points to a ' + _tB;
            }
          } catch (eTC) {}
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf,
                   disagreed: haveNum, dbg: dbg2 };
        }
      }
    }
    return best;
  }

  // ══ v0.9.1084 — the reader answered correctly; we took the wrong number ═══
  // Brad: "i think its how our app is reading the info wrong." He was right, and
  // it is a better diagnosis than mine. On his 6801 boat flatcar the reader
  // returned:
  //
  //   "Lionel Lionel Lines Lionel 6801-75 O/O27 Gauge Postwar Red Flat Freight
  //    Car ... manufactured by Lionel in 1958 (1957) — No. 6-16661"
  //
  // It said POSTWAR and it named 6801-75. The app filed it as 6-16661, Lionel
  // MPC/Modern. Same on his rocket flatcar: description "Postwar '6175' Flatcar
  // with rocket", filed as 6-39457.
  //
  // The cause is the question we ask. "Manufacturer SKU or catalog number" gets
  // answered with the SKU — and for a piece still in production as a reissue,
  // the SKU is the MODERN one. The postwar number lands in the description
  // instead, where nothing was looking for it.
  //
  // So: every number the reader mentioned anywhere in its answer is a candidate,
  // and the one that exists in the catalog the PHOTO says it belongs to wins.
  // The reader is not corrected — it is read properly.
  function _pinReconcileAiNum(meta, aiText, prefer) {
    var out = { num: (meta && meta.itemNum) ? String(meta.itemNum).trim() : '', swappedFrom: '' };
    // v0.9.1165: run for a multi-era filter too. This used to return here
    // whenever prefer.era was '' — which is exactly what "Any Era" produces — so
    // the whole rescue chain was silently disabled for Brad's actual filter.
    var _eras = _prefEras(prefer);
    if (!_eras.length || typeof findMaster !== 'function') return out;

    var inEra = function (c) {
      if (!c) return false;
      try {
        var r = findMaster(c, null, prefer);
        return !!(r && _eras.indexOf(r._era) >= 0);
      } catch (e) { return false; }
    };
    // Already right — leave it alone.
    if (out.num && inEra(out.num)) return out;

    // Candidates, best sources first: the fields the reader labelled, then
    // anything number-shaped in the whole answer.
    var pool = [];
    var push = function (v) {
      String(v || '').toUpperCase().replace(/[^0-9A-Z\s-]/g, ' ')
        .match(/\d[\dA-Z]*(?:-[\dA-Z]+)*/g)
        ?.forEach(function (t) {
          t = t.replace(/^-+|-+$/g, '');
          if (t.length >= 3 && t.length <= 12 && pool.indexOf(t) < 0) pool.push(t);
        });
    };
    if (meta) { push(meta.description); push(meta.title); push(meta.formNumber); }
    push(aiText);

    for (var i = 0; i < pool.length; i++) {
      var c = pool[i];
      if (c === out.num) continue;
      if (inEra(c)) { out.swappedFrom = out.num; out.num = c; return out; }
      // the reader writes 6801-75 for a variation of 6801 — accept the base
      var base = c.split('-')[0];
      if (base && base !== c && base.length >= 3 && inEra(base)) {
        out.swappedFrom = out.num; out.num = c; return out;
      }
    }
    // v0.9.1089: nothing in the stamped catalog directly — but one of the
    // numbers may be quoted by a stamped-era row (the reissue naming its
    // original). The tag settles it.
    if (typeof _pinQuoteMatch === 'function') {
      var qcands = [out.num].concat(pool);
      for (var q = 0; q < qcands.length; q++) {
        var qm2 = qcands[q] && _pinQuoteMatch(qcands[q], prefer);
        if (qm2 && qm2.row && qm2.row.itemNum && String(qm2.row.itemNum) !== out.num) {
          out.swappedFrom = out.num; out.num = String(qm2.row.itemNum);
          out.viaQuote = qm2.quoted;
          return out;
        }
      }
    }
    // v0.9.1164 — LAST RESORT: the reader's WORDS. Brad's M-K-T Legacy 0-8-0
    // showed the gap. The paid reader named the item exactly ("M-K-T LEGACY
    // 0-8-0 #43" is the catalog description of Lionel 2631200, near-verbatim,
    // and Brad confirmed "it is a lionel") and then attached 20-3151-1 — a real
    // number, but MTH's Union Pacific 0-8-0. Everything above hunts for NUMBERS,
    // and no number in that answer leads to 2631200, so the rescue never had a
    // chance.
    //
    // _pinDescMatch already scores catalog rows by rarity-weighted word overlap
    // within the filtered era, and it was wired into the FREE OCR path only — so
    // the read that costs a token could not use the app's best tool. Same
    // matcher, called from one more place: no second implementation to drift.
    //
    // It runs only once the numbers have failed, and its own thresholds (two
    // distinct words, or one long-or-punctuated near-unique word; real matched
    // substance; a clear winner) decide whether there is an answer at all.
    // Returned FLAGGED (viaDesc + descOf) because it overrides a number the
    // reader stated out loud: the card offers it for confirmation, and the user
    // can see both what matched and which row it landed on.
    if (typeof _pinDescMatch === 'function') {
      try {
        var dmR = _pinDescMatch(aiText || (meta && meta.description) || '', prefer);
        if (dmR && dmR.row && dmR.row.itemNum && String(dmR.row.itemNum) !== out.num) {
          out.swappedFrom = out.num;
          out.num = String(dmR.row.itemNum);
          out.viaDesc = (dmR.words || []).join(', ');
          out.descOf = [dmR.row.description, dmR.row.roadName]
            .filter(Boolean)
            .filter(function (v, i, a) {
              return a.findIndex(function (x) { return String(x).toLowerCase() === String(v).toLowerCase(); }) === i;
            })
            .join(' — ');
          return out;
        }
      } catch (eDsc) { console.warn('[Inbox] word rescue failed:', eDsc && eDsc.message); }
    }
    return out;
  }

  // v0.9.1083 — what we know about a photo, in the shape the paid reader wants.
  // Three of the four paid call sites were passing `{}`: the reader was being
  // asked "what is this?" with no mention of the era stamped on the photo, and
  // answering from a web that is overwhelmingly modern reissues.
  function _pinAiHints(group, extra) {
    var h = {};
    try {
      var pref = _pinPreferOf(group);
      // v0.9.1157: read the constraint off `pref` itself instead of re-deriving
      // it from ERAS[pref.era]. A chip filter spanning several eras has no
      // single era key, and gating on `pref.era` threw away a perfectly good
      // maker + scale constraint whenever it was blank.
      if (pref && (pref.label || pref.manufacturer || pref.scale || pref.type)) {
        h.eraLabel = pref.label || '';
        h.eraYears = pref.years || '';
        if (pref.manufacturer) h.mfrs = [pref.manufacturer];
        if (pref.scale) h.scale = pref.scale;
        // v0.9.1297: the Type tag goes to the paid reader too — the relay
        // already weaves hints.type into its subject line.
        if (pref.type) h.type = pref.type;
        // Said plainly as well as structurally — the relay weaves `note` into
        // the prompt, and a sentence survives a prompt rewrite better than a
        // field name does.
        h.note = 'This is a ' + (h.eraLabel || 'vintage') + (h.eraYears ? ' (' + h.eraYears + ')' : '')
          + ' item. Identify the ORIGINAL piece from that period, not a modern reissue,'
          + ' remake or Celebration Series version carrying the same number.';
      }
    } catch (e) {}
    if (extra && extra.note) h.note = (h.note ? h.note + ' ' : '') + extra.note;
    if (extra && extra.mfrs) h.mfrs = extra.mfrs;
    return h;
  }

  // v0.9.1092 — the photo actually ON SCREEN in the review card, which since
  // per-member reads is the one every read button should mean. Falls back to
  // the group's readable photo when the card is not open or nothing was tapped.
  function _pinOnScreenFid() {
    try {
      var img = document.getElementById('pin-rv-main');
      var fid = img && img.getAttribute('data-rvbig');
      if (fid) return fid;
    } catch (e) {}
    try { return _pinReadFid(_rvGroups[0]); } catch (e2) { return ''; }
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
      var af = (typeof rrActiveFilter === 'function') ? rrActiveFilter(m.era || '') : null;
      // v0.9.1297 (Brad: "the photo reader needs to use the type as a helper
      // to decide what it is"): the photo's own Type tag rides on the prefer
      // object — even when no era filter resolves, a typed photo still gets
      // its type hint.
      if (!af) return m.type ? { era: '', eras: [], manufacturer: '', label: '', years: '', scale: '', type: m.type, _fromFilter: true } : null;
      return {
        era:          af.era || '',        // '' when the filter spans several eras
        eras:         (af.eras && af.eras.length) ? af.eras : (af.era ? [af.era] : []),
        manufacturer: af.manufacturer || '',
        label:        af.label || '',
        years:        af.years || '',
        scale:        af.scale || '',
        type:         m.type || '',
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
      try { r2 = await _freeReadBlob(bytes, 2400, pref); } catch (e2) {}
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
    for (var i = 0; i < _groups.length; i++) {
      for (var j = 0; j < _groups[i].files.length; j++) {
        if (_groups[i].files[j].id === fileId) return _pinPreferOf(_groups[i]);
      }
    }
    return null;
  }
  // ── Shared free identify engine ──────────────────────────────────────────
  // Barcode (via the wizard's UPC resolver) + printed-number OCR, master-
  // confirmed. Exposed globally so EVERY screen (inbox, wizard Identify,
  // Research by Photo) can try the free read before spending a paid AI credit.
  // Returns { itemNum, matched:true } only on a CONFIDENT (master-backed) hit.
  window.rrIdentifyFree = async function (blob) {
    try {
      var r = await _freeReadBlob(blob);
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
    if (!_rvGroups || !_rvGroups.length) return;
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
    var fid = _pinOnScreenFid() || _rvGroups[0].files[0].id;
    var key = _rvGroups[0].key;
    var btn = document.getElementById('pin-rv-rescan');
    var _reBusy = _pinBtnBusy(btn, 'Re-scanning\u2026');
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
      var _pf = _preferForFid(fid);
      var _pfR = Object.assign({}, _pf || {}, { reject: _rejected });
      _pinStep(RR_READ_STEPS.bigger);
      var r = await _freeReadBlob(blob, 2400, _pfR);
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
          ? 'The free reader could not pick out a number this time — your earlier identification has been kept, nothing was lost'
          : 'The free reader could not pick out a number on this one — type it in, or use “Read this photo” for a closer look', 4500);
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
    _groups.forEach(function (g) {
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
      if (nSkip && !_selectMode) {
        sn.textContent = nSkip + ' photo' + (nSkip === 1 ? '' : 's') + ' tagged Paper, Catalog or Other '
          + (nSkip === 1 ? 'is' : 'are') + " not in the batch — there's rarely an item number on a drawing or a page. "
          + 'Tick one and press Identify to read it anyway.';
        sn.style.display = '';
      } else sn.style.display = 'none';
    }
    if (n > 0 && !_selectMode) {
      b.textContent = 'Identify my items — read ' + n + ' (free)';
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
    if (_busy || _autoReadBusy) { _pinBusyBounce(); return; }
    if (!_pinUnreadTodo().length) { showToast('Nothing waiting to be read', 2600); return; }
    await _pinAutoRead();
    try { _updateIdentifyBtn(); } catch (e) {}
  };

  async function _pinAutoRead() {
    if (_autoReadBusy || !_groups.length) return;
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
    ov.onclick = function (e) { if (e.target === ov) close(); };
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
    try { if (typeof loadDriveThumb === 'function') loadDriveThumb(fid, img, img.parentElement, null, 'hi'); } catch (e) {}
    try {
      if (!_qcToken()) return;
      var blob = await _pinBytes(fid);
      var u = URL.createObjectURL(blob);
      if (img.getAttribute('data-rvbig') === fid) img.src = u;   // still the current main
    } catch (e) { /* keep the thumbnail */ }
  };
  window._pinRvSetMain = function (fid) {
    var img = document.getElementById('pin-rv-main');
    if (!img) return;
    img.setAttribute('data-rvbig', fid);
    window._pinRvLoadFull(img, fid);
    // v0.9.1090: the identification follows the photo. Tap the Summit car and
    // the line describes the Summit car, not the engine at the front of the
    // group.
    try {
      var line = document.getElementById('pin-rv-ailine');
      if (line) line.innerHTML = _pinAiLine(fid) || line.innerHTML;
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
      var _e = _ids()[fid] || {};
      var _num = _e.num ? String(_e.num) : '';
      var _box = document.getElementById('pin-rv-num');
      _rvAiMfr = _e.mfr || '';          // the maker hint belongs to this photo too
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
    if (typeof window._openCropper !== 'function' || typeof Cropper === 'undefined') { showToast('Crop tool still loading — try again in a moment', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    var srcUrl = null;
    try {
      var blob0 = await _pinBytes(fid);
      srcUrl = URL.createObjectURL(blob0);
    } catch (e) { showToast(rrSaveError(e, 'the photo for cropping', { kept: false }), 3000, true); return; }
    window._openCropper(srcUrl, async function (blob) {
      try { URL.revokeObjectURL(srcUrl); } catch (e1) {}
      try {
        var resp = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fid + '?uploadType=media', {
          method: 'PATCH', headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'image/jpeg' }, body: blob
        });
        if (!resp.ok) { showToast('Could not save the crop (HTTP ' + resp.status + ') — the original is untouched', 3500, true); return; }
        // Bust the shared thumbnail cache so every view shows the new bytes.
        var fresh = URL.createObjectURL(blob);
        try {
          if (typeof _blobCache !== 'undefined') {
            if (_blobCache[fid]) { try { URL.revokeObjectURL(_blobCache[fid]); } catch (e2) {} }
            _blobCache[fid] = fresh;
          }
        } catch (e3) {}
        // v0.9.961 (Brad): remember this file is cropped so future visits load
        // its real bytes, not Drive's stale preview; drop any cached stale link.
        _markCropped(fid);
        try { if (typeof _thumbLinkCache !== 'undefined') delete _thumbLinkCache[fid]; } catch (eTL) {}
        // Update every on-screen copy incl. the review modal's main image (data-rvbig).
        document.querySelectorAll('img[data-rvfid="' + fid + '"], img[data-fid="' + fid + '"], img[data-ppfid="' + fid + '"], img[data-rvbig="' + fid + '"]').forEach(function (im) { im.src = fresh; });
        // v0.9.1297 (Brad): the crop CLEARS the old read (a number lifted off
        // the uncropped frame is exactly the read to replace) but no longer
        // re-reads on the spot — reads run when he hits Identify my items,
        // after all the cropping, tagging and grouping is done. The cleared
        // read makes this photo count as unread, so the button picks it up.
        try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (eA) {}
        try { var ff = _freeTried(); if (ff[fid]) { delete ff[fid]; _freeTriedSave(ff); } } catch (eB) {}
        showToast('Cropped — it’ll be read fresh when you hit Identify my items', 3000);
        try { _render(); } catch (eC) {}
        try { _updateIdentifyBtn(); } catch (eD) {}
      } catch (e4) { showToast('Could not save the crop — the original is untouched', 3000, true); }
    }, function () { try { URL.revokeObjectURL(srcUrl); } catch (e5) {} });
  };

  // v0.9.1297 (Brad): the "Re-read cropped" button and its machinery
  // (_pinCroppedGroups / _updateRecropBtn / _pinReadCropped, v0.9.1058) are
  // GONE — with reads running on demand, cropping happens BEFORE the first
  // read, and a crop that comes after one clears the stale read anyway, so
  // the cropped photo is simply unread again and Identify my items covers
  // it. One button, one waiting-list (_pinUnreadTodo), one loop.

  // ══ Image preparation for the free reader ════════════════════════════════
  // These passes came out of the v0.9.1063 reader audit, which ran the free
  // reader over Brad's whole inbox under several preprocessing variants and
  // scored them by how many numbers the CATALOG confirmed — not by how many
  // digits were read, since a variant that reads more and confirms fewer is
  // reading noise. "sharp" won and is what ships. The audit tool itself was
  // removed in v0.9.1352; what it taught is below, and _auditCanvas /
  // _auditTile keep their names because the live read path calls them.
  //
  // Local (adaptive) threshold, shared by the 'local' and 'chan' passes.
  // Compares each pixel with the mean of its own neighbourhood via an
  // integral image, so uneven lighting and specular highlights stop deciding
  // the result for the whole photo.
  function _localThreshold(c) {
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
      // v0.9.1080 — a silver passenger car has a blown-out highlight along the
      // roof and deep shadow under the skirt, so the global stretch is decided
      // by those two extremes and the lettering in between barely moves. Compare
      // each pixel with the average of its own neighbourhood instead: what
      // matters is whether a pixel is darker than the metal AROUND it, not
      // darker than the brightest thing in the photo. This is the standard
      // answer for reflective surfaces and uneven lighting.
      var box = Math.max(8, Math.round(Math.min(w, h) / 40));
      var integral = new Float64Array((w + 1) * (h + 1));
      var xx, yy;
      for (yy = 0; yy < h; yy++) {
        var rowSum = 0;
        for (xx = 0; xx < w; xx++) {
          rowSum += d[((yy * w) + xx) * 4];
          integral[((yy + 1) * (w + 1)) + (xx + 1)] = integral[(yy * (w + 1)) + (xx + 1)] + rowSum;
        }
      }
      var area = function (x0, y0, x1, y1) {
        return integral[(y1 * (w + 1)) + x1] - integral[(y0 * (w + 1)) + x1]
             - integral[(y1 * (w + 1)) + x0] + integral[(y0 * (w + 1)) + x0];
      };
      var outBuf = new Uint8ClampedArray(w * h);
      for (yy = 0; yy < h; yy++) {
        var y0 = Math.max(0, yy - box), y1 = Math.min(h, yy + box + 1);
        for (xx = 0; xx < w; xx++) {
          var x0 = Math.max(0, xx - box), x1 = Math.min(w, xx + box + 1);
          var n = (x1 - x0) * (y1 - y0);
          var mean = area(x0, y0, x1, y1) / n;
          var v2 = d[((yy * w) + xx) * 4];
          // 6% below the local mean counts as ink — tolerant enough for thin
          // stamped lettering, tight enough not to turn noise black.
          outBuf[(yy * w) + xx] = (v2 < mean * 0.94) ? 0 : 255;
        }
      }
      for (yy = 0; yy < h; yy++) {
        for (xx = 0; xx < w; xx++) {
          var o2 = ((yy * w) + xx) * 4;
          d[o2] = d[o2 + 1] = d[o2 + 2] = outBuf[(yy * w) + xx];
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
  }

  // ══ v0.9.1082 — the tiles were never preprocessed ═══════════════════════
  // _auditTile took a `mode` argument and ignored it completely: every band got
  // a plain grayscale stretch, whatever the pass was supposed to be doing. So
  // the inverted pass never inverted a band, the local threshold never touched
  // one, and tonight's colour-channel work would not have reached them either —
  // on the TILED pass, which is the one that won the audit and the one Brad's
  // red flatcars depend on. It won despite this.
  //
  // Making the canvas and processing it are separate jobs now, and the whole
  // frame and each band run the identical code.
  function _applyMode(c, mode) {
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    // grayscale + histogram bounds
    var lo = 255, hi = 0, i;
    for (i = 0; i < d.length; i += 4) {
      var g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    // stretch to full range — this is what a shiny silver car needs, where the
    // whole photo lives in a narrow band of greys
    var span = Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) {
      var v = ((d[i] - lo) * 255 / span);
      v = v < 0 ? 0 : (v > 255 ? 255 : v);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    if (mode === 'chan') {
      // ══ v0.9.1081 — read the colour channel that actually shows the text ═══
      // Brad: "get the photo id to read the red flatcar numbers. this should be
      // easy." He was right, and the reason it was not working has nothing to do
      // with size or focus. Converting to grayscale mixes the three channels by
      // 0.299R + 0.587G + 0.114B, and on a warm-coloured body that mix destroys
      // the very contrast we need:
      //
      //   white lettering on...   grayscale   red ch   green ch   blue ch
      //   red flatcar                   169       54        220       212
      //   orange gang car               115       18        142       228
      //   yellow barrel car              62       10         60       210
      //
      // A yellow car keeps 62 levels of separation in grayscale and 210 in blue.
      // We were discarding three and a half times the signal before the reader
      // ever saw the photo. Lionel painted an awful lot of red, orange and
      // yellow rolling stock.
      //
      // So: measure each channel's spread and keep whichever one separates best,
      // rather than blending all three into mush. On a silver or black body the
      // channels are near-identical and this behaves exactly like grayscale.
      var n2 = 0, sum = [0, 0, 0], sumSq = [0, 0, 0];
      var step = Math.max(4, Math.floor((w * h) / 40000)) * 4;   // sample, don't scan
      for (var q = 0; q < d.length; q += step) {
        for (var ch = 0; ch < 3; ch++) {
          var vq = d[q + ch];
          sum[ch] += vq; sumSq[ch] += vq * vq;
        }
        n2++;
      }
      var best = 0, bestSd = -1;
      for (var ch2 = 0; ch2 < 3; ch2++) {
        var mean2 = sum[ch2] / Math.max(1, n2);
        var sd = Math.sqrt(Math.max(0, (sumSq[ch2] / Math.max(1, n2)) - (mean2 * mean2)));
        if (sd > bestSd) { bestSd = sd; best = ch2; }
      }
      for (var p2 = 0; p2 < d.length; p2 += 4) {
        var vv = d[p2 + best];
        d[p2] = d[p2 + 1] = d[p2 + 2] = vv;
      }
      ctx.putImageData(img, 0, 0);
      // then the same local threshold, which is what copes with the highlights
      return _localThreshold(c);
    }
    if (mode === 'local') { return _localThreshold(c); }
    if (mode === 'invert') {
      for (i = 0; i < d.length; i += 4) {
        d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
      }
    }
    if (mode === 'sharp' || mode === 'invert') {
      // unsharp mask: subtract a cheap 3x3 blur, add the difference back
      var src = new Uint8ClampedArray(d.length);
      src.set(d);
      var idx = function (x, y) { return ((y * w) + x) * 4; };
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var sum = 0;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) sum += src[idx(x + dx, y + dy)];
          var blur = sum / 9;
          var o = idx(x, y);
          var sharp = src[o] + (src[o] - blur) * 1.8;
          d[o] = d[o + 1] = d[o + 2] = sharp < 0 ? 0 : (sharp > 255 ? 255 : sharp);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ══ v0.9.1101 — the color veto ═══════════════════════════════════════════
  // Brad: "can we compare our item picture is probably black or red and the
  // answer we think is probably red?" Yes — as a VETO only. The photo's
  // dominant body colors come from the middle of the frame (the shelf and
  // wall live at the edges); the answer's colors come from words in its own
  // catalog rows. When the row names colors and NONE of them — or their
  // lighting-blurred neighbours — appear in the photo, the match is demoted
  // to a guess and the card says why. It never confirms: warm light lies,
  // loads sit on cars, and half the catalog names no color at all.
  var _PIN_COLOR_WORDS = {
    RED: 'red', MAROON: 'red', TUSCAN: 'brown', ORANGE: 'orange',
    YELLOW: 'yellow', GOLD: 'yellow', BLACK: 'black', BLUE: 'blue',
    GREEN: 'green', GRAY: 'gray', GREY: 'gray', SILVER: 'gray',
    WHITE: 'white', CREAM: 'white', IVORY: 'white', BROWN: 'brown',
  };
  function _pinColorWords(str) {
    var out = {};
    String(str || '').toUpperCase().replace(/[A-Z]+/g, function (w) {
      if (_PIN_COLOR_WORDS[w]) out[_PIN_COLOR_WORDS[w]] = 1;
      return w;
    });
    return Object.keys(out);
  }
  function _pinPhotoColors(bmp) {
    try {
      var W = 96, H = Math.max(8, Math.round(bmp.height * W / bmp.width));
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0, W, H);
      var y0 = Math.floor(H * 0.30), hh = Math.max(1, Math.ceil(H * 0.85) - y0);
      var d = ctx.getImageData(0, y0, W, hh).data;
      var n = {}, total = 0;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), sp = mx - mn;
        var col;
        if (mx < 62) col = 'black';
        else if (mn > 185 && sp < 45) col = 'white';
        else if (sp < 34) col = 'gray';
        else if (r >= g && r >= b) {
          if (g > r * 0.72) col = 'yellow';
          else if (g > r * 0.45) col = (mx < 140 ? 'brown' : 'orange');
          else col = (mx < 120 ? 'brown' : 'red');
        } else if (g >= b) col = 'green';
        else col = 'blue';
        n[col] = (n[col] || 0) + 1; total++;
      }
      if (!total) return null;
      return Object.keys(n).sort(function (a, b2) { return n[b2] - n[a]; })
        .filter(function (k) { return n[k] / total >= 0.12; })
        .slice(0, 3);
    } catch (e) { return null; }
  }
  // Colors that lighting, fading and shadow blur into one another. A clash
  // must clear ALL of these to count — better to miss a veto than fire a
  // false one.
  var _PIN_COLOR_NEAR = {
    red: ['brown', 'orange'], brown: ['red', 'black', 'orange'],
    orange: ['red', 'yellow', 'brown'], yellow: ['white'],
    gray: ['white', 'black', 'blue'], white: ['gray', 'yellow'],
    black: ['brown', 'gray', 'blue'], blue: ['black', 'gray', 'green'],
    green: ['blue', 'black'],
  };
  function _pinColorClash(photoCols, rows) {
    if (!photoCols || !photoCols.length || !rows || !rows.length) return '';
    var rowCols = {}, any = false;
    rows.forEach(function (rw) {
      // v0.9.1102: the curated Body Color column (text pass + COTT photo
      // sampling) outranks parsing prose — when a row carries it, it IS the
      // answer. Prose fallback reads varDesc, the variation TEXT; `variation`
      // is just the variation number and never held a color.
      var srcTxt = (rw && rw.bodyColor)
        ? String(rw.bodyColor).replace(/\(photo\)/ig, '')
        : [rw && rw.description, rw && rw.roadName, rw && rw.varDesc]
            .filter(Boolean).join(' ');
      _pinColorWords(srcTxt).forEach(function (cw) { rowCols[cw] = 1; any = true; });
    });
    if (!any) return '';
    // Judged on the photo's DOMINANT color only. Every shelf photo carries
    // black frames and gray track as secondary colors, and letting those
    // vote cleared every veto through the neighbour table.
    var pc0 = photoCols[0];
    var okC = !!rowCols[pc0]
      || (_PIN_COLOR_NEAR[pc0] || []).some(function (nc) { return rowCols[nc]; });
    if (okC) return '';
    return 'the photo looks ' + photoCols.join('/')
      + '; this item is described as ' + Object.keys(rowCols).join('/');
  }

  // ══ v0.9.1095 — the white-stamp sheet ════════════════════════════════════
  // min(R,G,B) per pixel: white lettering keeps every channel high; coloured
  // plastic always has at least one dark channel. The result is a frame where
  // any red, blue, green or black body is near-black and the stamped number
  // glows. Then six overlapping close-up cells (middle + bottom thirds, three
  // columns each with a half-column of overlap so a number straddling a cut
  // is whole in one of them), each blown up 2-3x, stacked into one tall sheet
  // with white gaps — one recognize() call instead of six.
  // The top third is deliberately absent: that is where Brad's pinned catalog
  // pages and shelf clutter live, and this pass has no middle-band demotion
  // to protect it.
  function _stampSheet(bmp, maxDim) {
    var sc0 = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var W = Math.max(3, Math.round(bmp.width * sc0)), H = Math.max(3, Math.round(bmp.height * sc0));
    var src = document.createElement('canvas'); src.width = W; src.height = H;
    var sctx = src.getContext('2d');
    sctx.drawImage(bmp, 0, 0, W, H);
    var d = sctx.getImageData(0, 0, W, H), px = d.data;
    for (var i = 0; i < px.length; i += 4) {
      var m = Math.min(px[i], px[i + 1], px[i + 2]);
      px[i] = px[i + 1] = px[i + 2] = m;
    }
    sctx.putImageData(d, 0, 0);
    var third = Math.floor(H / 3), over = Math.floor(W / 12);
    var cells = [], CAP = 2900, GAP = 50;
    for (var rI = 1; rI <= 2; rI++) {
      var y0 = rI * third, h0 = (rI === 2) ? (H - y0) : third;
      if (h0 < 3) continue;
      for (var cI = 0; cI < 3; cI++) {
        var x0 = Math.max(0, Math.floor(W * cI / 3) - over);
        var x1 = Math.min(W, Math.floor(W * (cI + 1) / 3) + over);
        var cw = x1 - x0;
        if (cw < 3) continue;
        var sc = Math.max(2, Math.min(3, Math.floor(CAP / cw) || 2));
        cells.push({ x: x0, y: y0, w: cw, h: h0, sc: sc });
      }
    }
    var sheetW = 3, sheetH = GAP;
    cells.forEach(function (cl) {
      sheetW = Math.max(sheetW, cl.w * cl.sc);
      sheetH += cl.h * cl.sc + GAP;
    });
    var sheet = document.createElement('canvas'); sheet.width = sheetW; sheet.height = sheetH;
    var ctx = sheet.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sheetW, sheetH);
    ctx.imageSmoothingEnabled = true;
    var y = GAP;
    cells.forEach(function (cl) {
      ctx.drawImage(src, cl.x, cl.y, cl.w, cl.h, 0, y, cl.w * cl.sc, cl.h * cl.sc);
      y += cl.h * cl.sc + GAP;
    });
    return sheet;
  }

  // The fine cells for the stamp pass's block-mode reads: the 25%–100% band
  // (wall clutter lives in the top quarter), three rows with a whisker of
  // vertical overlap and three columns with half a column of overlap, each
  // blown up so small sill stamps become large glyphs. Read one at a time.
  function _stampCells(bmp, maxDim) {
    var sc0 = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var W = Math.max(3, Math.round(bmp.width * sc0)), H = Math.max(3, Math.round(bmp.height * sc0));
    var src = document.createElement('canvas'); src.width = W; src.height = H;
    var sctx = src.getContext('2d');
    sctx.drawImage(bmp, 0, 0, W, H);
    var d = sctx.getImageData(0, 0, W, H), px = d.data;
    for (var i = 0; i < px.length; i += 4) {
      var m = Math.min(px[i], px[i + 1], px[i + 2]);
      px[i] = px[i + 1] = px[i + 2] = m;
    }
    sctx.putImageData(d, 0, 0);
    var yLo = Math.floor(H * 0.25), BH = H - yLo;
    var over = Math.floor(W / 12), vPad = Math.floor(BH * 0.06);
    var out = [];
    for (var rI = 0; rI < 3; rI++) {
      var y0 = Math.max(yLo, yLo + Math.floor(BH * rI / 3) - vPad);
      var y1 = Math.min(H, yLo + Math.floor(BH * (rI + 1) / 3) + vPad);
      if (y1 - y0 < 3) continue;
      for (var cI = 0; cI < 3; cI++) {
        var x0 = Math.max(0, Math.floor(W * cI / 3) - over);
        var x1 = Math.min(W, Math.floor(W * (cI + 1) / 3) + over);
        var cw = x1 - x0, ch = y1 - y0;
        if (cw < 3) continue;
        var sc = Math.max(2, Math.min(6, Math.floor(2900 / cw) || 2));
        var cell = document.createElement('canvas');
        cell.width = cw * sc; cell.height = ch * sc;
        var cctx = cell.getContext('2d');
        cctx.imageSmoothingEnabled = true;
        cctx.drawImage(src, x0, y0, cw, ch, 0, 0, cw * sc, ch * sc);
        out.push(cell);
      }
    }
    // ── v0.9.1107 — the sill strips (Brad's 6175: "this should be easy...
    // why is this not picking up"). The number lives on the car's side sill —
    // a THIN line of text that drowns inside a tall cell full of body and
    // background. Sliding half-overlapping thin bands, two columns, blown up
    // hard, read the sill as the text LINE it is. His own photo reads "6175"
    // this way and no other. These run last within the pass, so the early
    // exit prunes them on every photo an earlier stage resolves.
    var bandH = Math.max(8, Math.floor(BH / 4));
    var step = Math.max(4, Math.floor(bandH / 2));
    for (var yS = yLo, bIdx = 0; yS + bandH <= H && bIdx < 8; yS += step, bIdx++) {
      for (var cS = 0; cS < 2; cS++) {
        var sx0 = Math.max(0, Math.floor(W * cS / 2) - Math.floor(W / 8));
        var sx1 = Math.min(W, Math.floor(W * (cS + 1) / 2) + Math.floor(W / 8));
        var sw = sx1 - sx0;
        if (sw < 8) continue;
        var sSc = Math.max(2, Math.min(8, Math.floor(3200 / sw) || 2));
        var strip = document.createElement('canvas');
        strip.width = sw * sSc; strip.height = bandH * sSc;
        var sctx2 = strip.getContext('2d');
        sctx2.imageSmoothingEnabled = true;
        sctx2.drawImage(src, sx0, yS, sw, bandH, 0, 0, sw * sSc, bandH * sSc);
        out.push(strip);
      }
    }
    return out;
  }

  function _auditCanvas(bmp, maxDim, mode) {
    var sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    if (mode === 'current') {
      try { ctx.filter = 'grayscale(1) contrast(1.3)'; } catch (e) {}
      ctx.drawImage(bmp, 0, 0, w, h);
      return c;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    return _applyMode(c, mode);
  }



  // Round 2. sharp6 won round 1 and is now the shipping default, so it is the
  // baseline every new idea has to beat. Each of the others attacks a specific
  // failure seen in Brad's 73: light lettering on a dark body (inverted),
  // letters being confused for digits (digits-only), and a number that is a
  // tiny part of a wide shelf photo (tiled — the single most common shape in
  // his inbox, and the one a whole-image pass is worst at).
  // One horizontal band of the photo, scaled up to the same working size, so
  // the lettering inside it is physically larger for the reader.
  function _auditTile(bmp, maxDim, mode, index, count) {
    var bh = Math.floor(bmp.height / count);
    var y0 = index * bh;
    var h0 = (index === count - 1) ? (bmp.height - y0) : bh;
    var sc = Math.min(3, maxDim / Math.max(bmp.width, h0));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(h0 * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, y0, bmp.width, h0, 0, 0, w, h);
    // v0.9.1082: the band gets the SAME treatment as the whole frame. It used to
    // get a plain stretch regardless of the pass, which quietly disabled every
    // preprocessing idea on the pass that works best.
    try { return _applyMode(c, mode); } catch (e) { try { _stretchCanvas(c); } catch (e2) {} }
    return c;
  }



  window._pinIdentifyAll = async function () {
    if (_busy) { _pinBusyBounce(); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var ids = _ids();
    // v0.9.1340: the type gate matters MOST here — this button spends a real
    // photo ID per item. Paper / Catalog / Other are held back; ticking one and
    // pressing Identify still reads it.
    var _allTodo = _groups.filter(function (g) { return !ids[_pinReadFid(g)]; });
    var todo = _allTodo.filter(function (g) { return !_pinSkipBatchGroup(g); });
    var _held = _allTodo.length - todo.length;
    if (!todo.length) {
      showToast(_held
          ? _held + ' photo' + (_held === 1 ? ' is' : 's are') + ' tagged Paper, Catalog or Other, so ' + (_held === 1 ? 'it is' : 'they are') + " not read in a batch — tick one and press Identify to read it anyway"
          : (_groups.length ? 'Every item already has a suggestion — tick photos and use Identify to re-run any of them' : 'Inbox is empty'),
        _held ? 6000 : 3500);
      return;
    }
    // v0.9.956 (Brad): free auto-read already tried these — this button only
    // targets the leftovers it couldn't place. Show the exact count and make
    // clear it uses paid reads, so a batch never spends credits by surprise.
    var n = todo.length;
    var msg = 'The free reader already tried every photo. <b>' + n + '</b> item' + (n === 1 ? '' : 's') +
      ' couldn\'t be matched for free. Read ' + (n === 1 ? 'it' : 'them') +
      ' now? This uses ' + n + ' of your photo ID' + (n === 1 ? '' : 's') + ' (1 per item).'
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
    if (_busy) { _pinBusyBounce(); return; }
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

  async function _pinIdentifyRun(todo, ids) {
    _setBusy(true, 'Identifying items'); _idAbort = false;
    var okN = 0, blankN = 0, failN = 0, guessN = 0;
    var remaining = null;   // v0.9.887 (Brad): reads-left-today tracker
    var _idStart = Date.now();   // v0.9.1174
    try {
      for (var i = 0; i < todo.length; i++) {
        if (_idAbort) break;
        var st = document.getElementById('pin-status');
        if (st) {
          var _etaI = _pinEtaText(i, todo.length, _idStart);
          st.style.display = 'block';
          st.innerHTML = 'Identifying item ' + (i + 1) + ' of ' + todo.length +
            (remaining !== null ? ' · ' + remaining + ' photo ID' + (remaining === 1 ? '' : 's') + ' left today' : '') +
            (_etaI ? ' · ' + _etaI : '') +
            '… keep this tab open — go get that coffee. ' +
            '<button onclick="_pinIdentifyCancel()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Stop</button>';
        }
        var g = todo[i], fid0 = _pinReadFid(g);
        try {
          // v0.9.896: Identify v2 — send EVERY photo of the group (cap 4)
          // in ONE call; more angles = better reads. aiIdentifyImage2 falls
          // back to v1 by itself on any v2 hiccup, so this can never be
          // worse than the old first-photo-only identify.
          // v0.9.1061: except the "together" shot. More angles help only while
          // every angle shows the SAME item; a set photo shows several, and
          // sending it invites the reader to answer with a neighbour's number.
          // v0.9.1090: extra photos help only while every photo shows the SAME
          // item. A set's members are different items — sending four different
          // cars as "angles" invites an answer about whichever is clearest.
          var _flA = _pinReadFiles(g);
          var _fl = (_pinFilesToRead(g).length > 1 ? _flA.slice(0, 1) : _flA.slice(0, 4)), blobs = [];
          for (var _b = 0; _b < _fl.length; _b++) {
            try { blobs.push(await _pinBytes(_fl[_b].id)); }
            catch (eB) { console.warn('[Inbox] photo download failed, skipping one:', eB && eB.message); }
          }
          if (!blobs.length) throw new Error('no photo bytes');
          // v0.9.942: a failed catalog-photo double-check leaves a note so the
          // retry knows which number was rejected and why.
          var _hints = _pinAiHints(g,
            (typeof _vfNote !== 'undefined' && _vfNote[g.key]) ? { note: _vfNote[g.key] } : null);
          var ai = (typeof aiIdentifyImage2 === 'function')
            ? await aiIdentifyImage2(blobs, _hints)
            : await aiIdentifyImage(blobs[0], _hints);
          // v0.9.1163: the batch used to break on 'quota' ONLY and otherwise
          // carry on to the next group. With reads switched off that meant
          // grinding silently through all 59 photos, spending nothing and
          // achieving nothing. Anything that will fail identically for every
          // remaining group must STOP the run and say why.
          if (!ai.ok && (ai.reason === 'quota' || ai.reason === 'optout'
                         || ai.reason === 'offline' || ai.reason === 'norelay')) {
            var _mB = (typeof rrReadFailMessage === 'function') ? rrReadFailMessage(ai.reason) : '';
            showToast(_mB || "Stopped — the reader is unavailable", 4500, true);
            break;
          }
          if (ai.ok && ai.text) {
            if (typeof ai.remaining === 'number') { remaining = ai.remaining; _tokSave(ai.remaining); }   // v0.9.969: persist the count for the review card
            var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
            // v0.9.1087: the batch writes to storage directly rather than through
            // _pinApplyMeta, so it reconciles here — same helper, group in hand.
            try {
              if (typeof _pinReconcileAiNum === 'function') {
                var _rcB = _pinReconcileAiNum(meta, ai.text, _pinPreferOf(g));
                if (_rcB && _rcB.num && _rcB.num !== meta.itemNum) {
                  meta._aiSku = _rcB.swappedFrom || meta.itemNum || '';
                  meta.itemNum = _rcB.num;
                  // v0.9.1164: same rule as the single read — a word match stays
                  // a best guess (so the tile shows the orange tag, not a
                  // confident blue) and carries its evidence.
                  if (_rcB.viaDesc) {
                    meta._hedge = 1;
                    meta._viaDesc = _rcB.viaDesc;
                    meta._descOf = _rcB.descOf || '';
                  } else {
                    meta._hedge = 0;
                  }
                }
              }
            } catch (eRB) { console.warn('[inbox] batch reconcile failed', eRB && eRB.message); }
            // v0.9.898 (Brad): KEEP hedged best guesses instead of discarding
            // them (the 30-9107 platform case: the wizard showed the guess with
            // a warning while the inbox said "no read"). guess:1 marks them —
            // tiles show an orange "best guess" tag, never a confident blue.
            var num = meta.itemNum ? String(meta.itemNum) : '';
            // v0.9.901 (Brad): the relay's v2.5 prompt lists look-alike twins on
            // a "Possible variants:" line (most likely first) — keep them so the
            // review card can offer pick-one chips. A variants line also means
            // the AI could NOT prove which twin it is → always a best guess.
            var alts = [];
            var altsM = String(ai.text).match(/^Possible variants?:\s*(.+)$/mi);
            if (altsM) alts = altsM[1].split('|').map(function (s) { return s.trim().slice(0, 70); }).filter(Boolean).slice(0, 4);
            var guess = (num && (meta._hedge || alts.length)) ? 1 : 0;
            // v0.9.894 (Brad): keep EVERYTHING the AI discovered, not just the
            // number — shown on the review card and fed into manual entry.
            var trim = function (v) { return String(v || '').slice(0, 120); };
            ids[fid0] = { num: num, guess: guess, alts: alts, tried: 1,
              // v0.9.1151 (pre-beta audit, BLOCKER 3): see the matching comment
              // on the other paid writer. Without rv, the background auto-reader
              // treats a paid read as "never read" and overwrites it with a free
              // one — destroying work the user paid for, silently.
              rv: READER_VER, paid: 1,
              mfr: trim(meta.manufacturer), desc: trim(meta.description),
              road: trim(meta.roadName), year: trim(meta.year),
              // v0.9.968 (Brad): carry scale + item-type through for wizard pre-fill.
              gauge: trim(meta.gauge), subType: trim(meta.subType),
              // v0.9.1164: the word-match evidence, in the same fields the free
              // path uses, so one disclosure renderer covers both routes.
              viaDesc: !!meta._viaDesc, descOf: meta._descOf || '',
              // v0.9.1085 (Brad's rocket flatcar: three different answers and no
              // way to tell why). The FREE reader has recorded its own text
              // since v0.9.1068 and every diagnosis today has come from reading
              // it. The PAID reader — the one that costs a credit and is
              // trusted more — kept nothing at all. It does now.
              aiRaw: String(ai.text || '').replace(/\s+/g, ' ').trim().slice(0, 900),
              aiSku: meta._aiSku || '' };
            // v0.9.902 (Brad): candidates-without-a-confident-number is a lead,
            // not "unreadable" — count it as a best guess so the toast matches
            // the orange tag on the tile and the chips on the review card.
            if (num && !guess) okN++; else if (num || alts.length) guessN++; else blankN++;
          } else {
            ids[fid0] = { num: '', tried: 1 };
            blankN++;
          }
          _idsSave(ids);
          _render();
        } catch (eOne) {
          console.warn('[Inbox] identify failed for a group:', eOne);
          failN++;   // not stored — retried on the next run
        }
      }
      _status('');
      var msg = 'Identified ' + okN + ' of ' + todo.length + ' item' + (todo.length > 1 ? 's' : '');
      if (guessN) msg += ' · ' + guessN + ' best guess' + (guessN > 1 ? 'es' : '') + ' (double-check those)';
      if (blankN) msg += ' · ' + blankN + ' unreadable (no number visible?)';
      if (failN) msg += ' · ' + failN + ' errored (run again to retry)';
      if (remaining !== null) msg += ' · ' + remaining + ' photo ID' + (remaining === 1 ? '' : 's') + ' left today';
      showToast(msg, 5000, (okN + guessN) === 0);
    } finally {
      _setBusy(false);
      var st2 = document.getElementById('pin-status');
      if (st2 && /Identifying/.test(st2.textContent || '')) _status('');
    }
  }

  // ── Import from Google Photos (Picker API, v0.9.885) ─────────
  // Session → Google's own picker tab → poll until the user hits
  // Done there → download each pick (auth'd baseUrl) → upload to the
  // inbox. Read-only scope; the app only ever sees what was picked.
  var _gpAbort = false;
  // ── v0.9.1417 (beta tester 1, iPhone) ────────────────────────────────
  // The waiting line and its Cancel button were written once, by the
  // onStatus callback, and nothing ever wrote them again. Any re-render
  // wiped both — and the inbox stays busy-locked for up to TEN MINUTES
  // while the picker poll runs. He tapped Add photos, got a red toast about
  // a batch he had never started, and had no cancel, no reason and no way
  // out short of reloading the app.
  //
  // So the wait now owns two facts — is it running, and did the tab open —
  // and ONE painter reads them. The painter is called from the poll (every
  // few seconds), from the blocked-button guard, and when the popup is
  // refused, which means the escape hatch cannot be more than one poll tick
  // away from being back on screen no matter what repainted over it.
  var _gpWaiting = false;
  var _gpPickerUri = '';
  window._pinGPhotosCancel = function () {
    _gpAbort = true; _gpWaiting = false; _gpPickerUri = '';
    _status('');
  };
  // Re-opening a blocked popup needs a gesture of its own, so this is wired
  // to a button the collector taps rather than called on their behalf.
  window._pinGPhotosOpenTab = function () {
    if (!_gpPickerUri) return;
    try { window.open(_gpPickerUri, '_blank'); } catch (e) {}
  };
  var _gpBtn = 'border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)';
  // Returns true when a Google Photos wait is what is holding the inbox, so
  // callers can tell "busy on the picker" from "busy on a real batch".
  function _pinGPStatus() {
    if (!_gpWaiting) return false;
    var st = document.getElementById('pin-status');
    if (!st) return true;
    st.style.display = 'block';
    st.innerHTML = (_gpPickerUri
        ? 'Your browser blocked the Google Photos tab. ' +
          '<button onclick="_pinGPhotosOpenTab()" style="' + _gpBtn + '">Open Google Photos</button> ' +
          '— pick your photos there, press <strong>Done</strong>, then come back. '
        : 'Pick photos in the Google Photos tab that just opened, then press <strong>Done</strong> there. Waiting… ') +
      '<button onclick="_pinGPhotosCancel()" style="' + _gpBtn + '">Cancel</button>';
    return true;
  }
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

  // v0.9.1254 (audit finding I): this used to hand a train collector a
  // Google Cloud Console link and tell them to enable an API. They cannot —
  // it is Brad's Cloud project, not theirs. Worse, the same dialog answered
  // two different problems:
  //
  //   403 — the Picker API is off for the project. NOBODY but Brad can fix
  //         this, and it is the same for every user at once.
  //   401 — this user's sign-in no longer carries the photo-picking
  //         permission. They CAN fix that, by signing in again.
  //
  // Split them, and never show the console link to a user.
  function _gpHelp(status) {
    if (status === 401) {
      var ov1 = document.createElement('div');
      ov1.id = 'pin-gp-help';
      ov1.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.2rem';
      ov1.innerHTML =
        '<div class="rr-card">' +
          '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);margin-bottom:0.5rem">One more permission needed</div>' +
          '<div style="font-size:0.82rem;color:var(--text-dim);line-height:1.6;margin-bottom:0.8rem">' +
            'To pick photos from Google Photos, sign out and back in once — Preferences \u2192 Sign Out \u2014 and say yes when Google asks about your photos. ' +
            'Your collection is not affected.' +
          '</div>' +
          '<button onclick="document.getElementById(\'pin-gp-help\').remove()" class="btn-primary" style="width:100%;padding:0.6rem;border-radius:8px;border:none;background:var(--accent);color:var(--on-accent);font-weight:700;cursor:pointer">Got it</button>' +
        '</div>';
      document.body.appendChild(ov1);
      return;
    }
    // 403 (or anything else): not the user's to fix. Say so plainly, offer
    // the way they already have of reaching a human, and stop there.
    var ov = document.createElement('div');
    ov.id = 'pin-gp-help';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.2rem';
    ov.innerHTML =
      '<div class="rr-card">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);margin-bottom:0.5rem">Google Photos picking is unavailable</div>' +
        '<div style="font-size:0.82rem;color:var(--text-dim);line-height:1.6;margin-bottom:0.8rem">' +
          'This one is on our side, not yours \u2014 nothing is wrong with your account or your collection. ' +
          'You can still add photos with <strong style="color:var(--text)">Upload</strong> or by taking one with the camera. ' +
          'If it stays broken, let us know at <a href="mailto:support@therailroster.com" style="color:var(--accent)">support@therailroster.com</a>.' +
        '</div>' +
        '<button onclick="document.getElementById(\'pin-gp-help\').remove()" class="btn-primary" style="width:100%;padding:0.6rem;border-radius:8px;border:none;background:var(--accent);color:var(--on-accent);font-weight:700;cursor:pointer">OK</button>' +
      '</div>';
    document.body.appendChild(ov);
    // Brad's console needs the actionable detail the user must not see.
    console.warn('[GPhotos] picker session refused (' + status + '). If this is 403, ' +
      'enable the Google Photos Picker API for the project: ' +
      'https://console.cloud.google.com/apis/library/photospicker.googleapis.com');
  }

  window._pinGPhotos = async function () {
    if (_busy) { _pinBusyBounce(); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    _setBusy(true, 'Google Photos import'); _gpAbort = false;
    _gpWaiting = true; _gpPickerUri = '';   // v0.9.1417: the wait is now a fact the painter can read
    try {
      // v0.9.1014 (Brad): the whole picker dance (tab, scope, session, poll,
      // list) now lives in ONE shared helper in drive.js — the same one the
      // Identify-from-Photo screen uses — so the two can never drift apart.
      var pick = await rrGPhotosPickSession({
        shouldAbort: function () { return _gpAbort; },
        // v0.9.1417: this used to build the waiting line inline, and drive.js
        // called it exactly once. Both halves moved: drive.js repaints on
        // every poll tick, and the markup lives in the one painter that the
        // busy guard also uses, so the Cancel button on screen and the Cancel
        // button a blocked tap restores are the same button.
        onStatus: function () { _pinGPStatus(); },
        onNeedTab: function (uri) { _gpPickerUri = uri; _pinGPStatus(); },
      });
      // v0.9.1417: the waiting is over the instant this returns — whatever
      // happens next writes its own status ("Importing 3 of 12…"), and the
      // painter must not be allowed to overwrite that with a stale Cancel.
      _gpWaiting = false; _gpPickerUri = '';
      if (pick.error) {
        _status('');
        if (pick.error === 'scope') showToast('Google Photos permission was not granted', 3500, true);
        else if (pick.error === 'session' && (pick.status === 403 || pick.status === 401)) _gpHelp(pick.status);
        else if (pick.error === 'timeout') showToast('Gave up waiting for the Google Photos picker after 10 minutes — try again', 4000, true);
        else if (pick.error !== 'cancelled') showToast('Google Photos picker error' + (pick.status ? ' (' + pick.status + ')' : '') + ' — try again', 3500, true);
        return;
      }
      var photos = pick.items.filter(function (m) { return String(m.type || '').toUpperCase() !== 'VIDEO'; });
      var skipped = pick.items.length - photos.length;
      var fid = await _folder();
      var ts = new Date().getTime(), ok = 0;
      for (var i = 0; i < photos.length; i++) {
        if (_gpAbort) break;
        _status('Importing ' + (i + 1) + ' of ' + photos.length + ' from Google Photos…');
        try {
          var f = await rrGPhotosFile(photos[i], pick.auth, 'photo-' + (i + 1) + '.jpg');
          await driveUploadFile(f, 'INBOX ' + ts + ' g' + (ts + i) + ' ' + f.name, fid);
          ok++;
        } catch (eOne) { console.warn('[Inbox] Google Photos item failed:', eOne); }
      }
      rrGPhotosEnd(pick.sessionId, pick.auth);
      _status('');
      var msg = 'Imported ' + ok + ' of ' + photos.length + ' photo' + (photos.length === 1 ? '' : 's') + ' from Google Photos';
      if (skipped) msg += ' (' + skipped + ' video' + (skipped > 1 ? 's' : '') + ' skipped)';
      showToast(msg, 3500, ok < photos.length);
      _pinRefresh();
    } catch (e) {
      console.error('[Inbox] Google Photos import:', e);
      _status('Google Photos import hit a snag — try again.');
    } finally { _setBusy(false); _gpWaiting = false; _gpPickerUri = ''; }
  };

  // ── Discard (Drive trash — recoverable ~30 days) ─────────────
  window._pinDiscard = async function (only) {
    // v0.9.1325: `only` names the groups outright (the review card's Discard
    // passes its own), so nothing has to be staged in the shared `_sel` map.
    var gs = (only && only.length) ? only.slice() : _selGroups();
    // v0.9.1418: a FOURTH silent guard, found while fixing the other three.
    // It spoke when nothing was ticked and said nothing at all when busy —
    // so Discard failed exactly the way Apply did.
    if (_busy) { _pinBusyBounce(); return; }
    if (!gs.length) { showToast('Select photos first', 2500, true); return; }
    var n = 0; gs.forEach(function (g) { n += g.files.length; });
    // v0.9.1325: was window.confirm — in the one file whose own comment
    // (see _pinConfirm) says a native dialog "would freeze the extension
    // bridge". Three native dialogs survived in here while every other
    // destructive action in the app used the styled panel. appConfirm is the
    // right target rather than the local _pinConfirm: it wires BackStack and
    // ESC, so the device Back button cancels instead of navigating the page
    // out from under the dialog.
    if (!(await appConfirm('Discard ' + n + ' photo' + (n > 1 ? 's' : '')
          + '? They go to your Google Drive trash, recoverable for about 30 days.',
          { title: 'Discard photos', ok: 'Discard', cancel: 'Keep them', danger: true }))) return;
    _setBusy(true, 'Discarding photos');
    try {
      // v0.9.1275 (R15): one failed trash used to abandon the rest of the
      // selection — photo 3 of 12 fails and 4..12 quietly stay put while the
      // status implies the whole discard failed. Each file gets its own try
      // now, and the toast reports what actually happened.
      var done = 0, _dcOk = 0, _dcFail = 0;
      for (var g = 0; g < gs.length; g++) {
        for (var f = 0; f < gs[g].files.length; f++) {
          done++;
          _status('Discarding ' + done + ' of ' + n + '…');
          try {
            await driveRequest('PATCH', '/files/' + gs[g].files[f].id, { trashed: true });
            _dcOk++;
          } catch (eDc) {
            _dcFail++;
            console.warn('[Inbox] discard failed — continuing:', gs[g].files[f].id, eDc);
          }
        }
      }
      _sel = {};
      _status('');
      if (_dcFail) showToast('Discarded ' + _dcOk + ' of ' + n + ' photo' + (n > 1 ? 's' : '') + ' \u2014 ' + _dcFail + ' would not discard and are still in the inbox.', 5000, true);
      else showToast('Discarded ' + n + ' photo' + (n > 1 ? 's' : ''), 2500);
      _pinRefresh();
      // v0.9.940 (Brad): discarding must land you back ON the Photo Inbox —
      // some entry paths were ending up on the Dashboard instead. Force it.
      try {
        if (!document.querySelector('#page-photo-inbox.active') && typeof showPage === 'function') {
          showPage('photo-inbox', document.getElementById('nav-photo-inbox'));
        }
      } catch (eNav) {}
    } catch (e) {
      console.error('[Inbox] discard:', e);
      _status('Discard failed partway — hit Refresh and try again.');
    } finally { _setBusy(false); }
  };

  // ── Badges + dashboard cards (v0.9.890) ──────────────────────
  var COUNT_KEY = 'rr_inbox_count';
  function _navBadge(count) {
    try { localStorage.setItem(COUNT_KEY, String(count)); } catch (e) {}
    var b = document.getElementById('nav-inbox-count');
    if (b) { b.textContent = count > 0 ? count : ''; b.style.display = count > 0 ? '' : 'none'; }
    var mb = document.getElementById('mnav-inbox-count');
    if (mb) { mb.textContent = count > 0 ? count : ''; mb.style.display = count > 0 ? '' : 'none'; }
    var cv = document.getElementById('pin-card-value');
    if (cv) cv.textContent = String(count);
  }

  // Lightweight count fetch — runs at startup so the badges and the
  // dashboard card are right BEFORE the inbox page is ever opened.
  // v0.9.1131 (audit #5): the badge counters also stopped at 200, so a big
  // inbox permanently read "200". Pages ids only — cheap, and the badge is the
  // number the user trusts to know there is work left.
  async function _pinCountAll(q) {
    var n = 0, tok = '', guard = 0;
    do {
      // v0.9.1275 (R15): a failed page used to throw the count away entirely
      // — page 3 of 4 hiccups and the badge silently stops updating. A count
      // that reached SOME pages is a floor, not a total; only pass it off as
      // the total if every page landed. Callers keep the previous badge on a
      // partial count, which is the same behaviour as a thrown error but
      // with the reason logged once here instead of guessed at.
      var r;
      try {
        r = await driveRequest('GET', '/files?q=' + q + '&fields=nextPageToken,files(id)&pageSize=200' +
          (tok ? '&pageToken=' + tok : ''));
      } catch (ePg) {
        console.warn('[Inbox] count stopped at ' + n + ' — a page failed:', ePg);
        throw ePg;   // an incomplete count must never land on the badge as if whole
      }
      n += ((r && r.files) || []).length;
      tok = (r && r.nextPageToken) || '';
    } while (tok && ++guard < 40);
    return n;
  }

  var _countBusy = false;
  async function _pinCountRefresh() {
    if (_countBusy || !_qcToken()) return;
    _countBusy = true;
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      _navBadge(await _pinCountAll(q));
    } catch (e) { /* offline / signed out — badge stays as-is */ }
    finally { _countBusy = false; }
  }
  window._pinCountRefresh = _pinCountRefresh;

  // Small stat card + large panel, registered into the dashboard's own
  // catalogs so Edit Dashboard can place/arrange them like any other.
  function _registerDashEntries() {
    try {
      if (typeof CARD_CATALOG !== 'undefined' && CARD_CATALOG.push && !CARD_CATALOG.some(function (c) { return c.id === 'photoInbox'; })) {
        CARD_CATALOG.push({
          id: 'photoInbox', label: 'Photo Inbox', color: '#2980b9',
          onclick: '_pinGo()',
          compute: function () {
            setTimeout(function () { _pinCountRefresh(); }, 0);
            var n = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10) || 0;
            return { html: '<div class="stat-value" id="pin-card-value">' + n + '</div>'
              + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px">photo' + (n === 1 ? '' : 's') + ' waiting — click to file</div>' };
          }
        });
      }
      if (typeof _CARD_HELP !== 'undefined') _CARD_HELP.photoInbox = 'Photos waiting in your Photo Inbox — snapped with Batch Add on your phone, dragged in on desktop, or imported from Google Photos. Click the card to review and file them.';
      if (typeof PANEL_CATALOG !== 'undefined' && PANEL_CATALOG.push && !PANEL_CATALOG.some(function (p) { return p.id === 'photoInbox'; })) {
        PANEL_CATALOG.push({
          id: 'photoInbox', label: 'Photo Inbox', icon: '📥',
          navFn: "_pinGo();",
          count: function () {
            var n = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10) || 0;
            return n ? (n + ' photo' + (n === 1 ? '' : 's')) : '';
          },
          render: function () {
            if (window._offlineMode || navigator.onLine === false) {
              return '<div style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.78rem;text-align:center">Photos will show when you’re back online</div>';
            }
            setTimeout(function () { _pinPanelFill(); }, 0);
            return '<div id="pin-panel-grid" onclick="window._fromDash=true;_pinGo()" title="Open Photo Inbox" style="cursor:pointer;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:0.5rem;min-height:120px"><div class="empty-state"><p>Loading inbox…</p></div></div>';
          }
        });
      }
    } catch (e) { console.warn('[Inbox] dash register:', e); }
  }

  async function _pinPanelFill() {
    var grid = document.getElementById('pin-panel-grid');
    if (!grid || !_qcToken()) return;
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&orderBy=createdTime desc&pageSize=200');
      var files = (res && res.files) || [];
      // the panel only draws a handful, but the badge must be the TRUE total.
      // v0.9.1275 (R15): the old fallback put files.length on the badge when
      // the full count failed — that is the FIRST PAGE (capped at 200) passed
      // off as the whole inbox. A page under the cap really is the whole
      // inbox, so it may stand in; at the cap the true total is unknown, and
      // a stale badge is more honest than a wrong one.
      _pinCountAll(q).then(function (n) { _navBadge(n); }).catch(function () {
        if (files.length < 200) _navBadge(files.length);
      });
      grid = document.getElementById('pin-panel-grid');
      if (!grid) return;
      if (!files.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Inbox is empty — snap some photos with Batch Add</p></div>';
        return;
      }
      // v0.9.893 (Brad): SAME column rule as the Showcase (shared helper) +
      // explicit column count — the old auto-fill CSS guessed differently
      // on his laptop (2 cols vs the Showcase's 3).
      var cols = (typeof window._dashPhotoCols === 'function') ? window._dashPhotoCols(grid)
        : Math.max(3, Math.floor((grid.clientWidth || 500) / 104));
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      // v0.9.892 (Brad): show EVERYTHING up to 3 rows (matches Showcase's
      // on-screen cap) — partial last row and all. Still no "+N" tile; the
      // header total covers the overflow beyond 3 rows.
      var show = files.slice(0, cols * 3);
      grid.innerHTML = show.map(function (f) {
        return '<div style="aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--surface2,#26262e)"><img loading="lazy" data-ppfid="' + f.id + '" style="width:100%;height:100%;object-fit:cover;display:block" alt=""></div>';
      }).join('');
      grid.querySelectorAll('img[data-ppfid]').forEach(function (img) {
        loadDriveThumb(img.getAttribute('data-ppfid'), img, img.parentElement, null, 'hi');
      });
    } catch (e) {
      if (grid) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Couldn’t load the inbox — open it to retry</p></div>';
    }
  }

  // One-time: put the new card in the first empty dashboard slot and the
  // panel on the dashboard (if there's room) so Brad sees them without a
  // trip through Edit Dashboard. Rearranging/removing after that is his.
  function _autoPlaceOnce() {
    try {
      if (localStorage.getItem('rr_inbox_dash_placed')) return;
      var placed = false;
      if (typeof _getSlots === 'function' && typeof _saveSlots === 'function') {
        var slots = _getSlots();
        if (!slots.some(function (s) { return s && s.id === 'photoInbox'; })) {
          var empty = slots.indexOf(null);
          if (empty >= 0) { slots[empty] = { id: 'photoInbox' }; _saveSlots(slots); placed = true; }
        } else placed = true;
      }
      if (typeof _getPanels === 'function' && typeof _savePanels === 'function') {
        var panels = _getPanels();
        if (!panels.some(function (p) { return p && p.id === 'photoInbox'; }) && panels.length < 3) {
          panels.push({ id: 'photoInbox' }); _savePanels(panels); placed = true;
        }
      }
      localStorage.setItem('rr_inbox_dash_placed', '1');
      if (placed) console.log('[Inbox] dashboard card/panel placed (one-time)');
    } catch (e) { console.warn('[Inbox] auto-place:', e); }
  }

  function _injectNav() {
    // Desktop sidebar entry
    if (!document.getElementById('nav-photo-inbox') && !window.IS_MOBILE_UA) {
      var prefsBtn = document.querySelector('.sidebar .nav-item[onclick*="prefs"]');
      if (prefsBtn && prefsBtn.parentNode) {
        var b = document.createElement('button');
        b.className = 'nav-item';
        b.id = 'nav-photo-inbox';
        b.setAttribute('data-ctip', 'Photos waiting to be filed to items.');
        b.setAttribute('onclick', '_pinGo(this)');
        b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>' +
          'Photo Inbox<span class="nav-badge" id="nav-inbox-count" style="display:none;background:#f8e8c0;color:#1a1a1a"></span>';
        prefsBtn.parentNode.insertBefore(b, prefsBtn);
      }
    }
    // v0.9.882 (Brad): phone bottom-nav entry too
    if (!document.getElementById('mnav-photo-inbox')) {
      var host = document.querySelector('.mobile-nav-items');
      if (host) {
        var mb = document.createElement('button');
        mb.className = 'mobile-nav-item';
        mb.id = 'mnav-photo-inbox';
        mb.style.position = 'relative';
        mb.setAttribute('onclick', '_pinGo(this)');
        mb.innerHTML = '<span id="mnav-inbox-count" style="display:none;position:absolute;top:1px;right:4px;background:#2980b9;color:#fff;border-radius:9px;font-size:0.58rem;font-weight:700;padding:1px 5px;line-height:1.3"></span>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>Inbox';
        // v0.9.1019 (Brad): Inbox is SPOT 6 on the bar — before Sets, after
        // For Sale — not tacked on the end where nobody scrolls.
        var _mnavSets = document.getElementById('mnav-sets');
        if (_mnavSets && _mnavSets.parentNode === host) host.insertBefore(mb, _mnavSets);
        else host.appendChild(mb);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // PHASE 2 — QUICK CAPTURE (phone) — v0.9.880, reworked v0.9.882
  // Two big buttons instead of an up-front mode question (Brad):
  //   "Photo of New Item"          — starts the next item (new group)
  //   "Another Photo of Same Item" — adds to the current item's group
  // Every shot uploads to the inbox in the background. Groups share
  // the g-tag so the desktop inbox shows them as one stack.
  // Extras: optional crop-each-photo toggle, and a strip of the most
  // recent shots (tap to review, re-crop, or rotate — the cropped
  // bytes replace the uploaded Drive file in place).
  // ═════════════════════════════════════════════════════════════
  var QC_CROP_KEY = 'rr_qc_crop';   // '1' = open the cropper on every shot
  var _qc = null;   // { base, group, shots, total, pending, failed:[{file,name,rec}], recent:[{url,name,driveId,group}], nextIsNew }

  function _qcToken() {
    if (!window.accessToken) {
      var s = localStorage.getItem('lv_token'), ex = parseInt(localStorage.getItem('lv_token_expiry') || '0', 10);
      if (s && ex > new Date().getTime()) window.accessToken = s;
    }
    return window.accessToken;
  }

  window._qcOpen = function () {
    if (!_qc) _qc = { base: new Date().getTime(), group: 1, shots: 0, total: 0, pending: 0, failed: [], recent: [], nextIsNew: false };
    var ov = document.getElementById('qc-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'qc-ov';
      ov.style.cssText = 'position:fixed;inset:0;background:var(--bg,#10132a);z-index:10000;display:flex;flex-direction:column;padding:max(0.8rem,env(safe-area-inset-top)) 0.9rem max(0.8rem,env(safe-area-inset-bottom))';
      document.body.appendChild(ov);
      var inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'qc-file'; inp.accept = 'image/*';
      inp.setAttribute('capture', 'environment');
      inp.style.display = 'none';
      inp.addEventListener('change', function () {
        var f = this.files && this.files[0];
        this.value = '';
        if (f) _qcShot(f);
      });
      ov.appendChild(inp);
      var body = document.createElement('div');
      body.id = 'qc-body';
      body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0';
      ov.appendChild(body);
      if (window.BackStack && BackStack.push) BackStack.push('qc-ov', window._qcDone);
    }
    _qcRender();
  };

  function _qcCropOn() { return localStorage.getItem(QC_CROP_KEY) === '1'; }
  window._qcCropToggle = function () {
    localStorage.setItem(QC_CROP_KEY, _qcCropOn() ? '0' : '1');
    _qcRender();
  };

  function _qcRender() {
    var body = document.getElementById('qc-body');
    if (!body) return;
    var counter = 'Item ' + _qc.group + (_qc.shots ? ' · ' + _qc.shots + ' photo' + (_qc.shots > 1 ? 's' : '') : '');
    var pend = '';
    if (_qc.pending > 0) pend += 'Uploading ' + _qc.pending + '… ';
    if (_qc.failed.length) pend += '<span style="color:#f05008;font-weight:700">' + _qc.failed.length + ' failed</span> <button onclick="_qcRetry()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Retry</button>';
    // Most-recent strip (newest first). Tap a shot to review / re-crop.
    var strip = '';
    if (_qc.recent.length) {
      strip = '<div style="display:flex;gap:0.45rem;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0.15rem 0.1rem;margin-bottom:0.6rem">' +
        _qc.recent.slice().reverse().map(function (r, i) {
          var realIdx = _qc.recent.length - 1 - i;
          return '<div onclick="_qcReview(' + realIdx + ')" style="flex-shrink:0;width:62px;height:62px;border-radius:9px;overflow:hidden;position:relative;border:2px solid ' + (r.group === _qc.group ? '#2980b9' : 'var(--border)') + ';cursor:pointer">' +
            '<img src="' + r.url + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="">' +
            '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);color:#fff;font-size:0.55rem;text-align:center;padding:0 2px">Item ' + r.group + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }
    body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">' +
        '<span style="font-family:var(--font-head);font-weight:700;font-size:1.05rem;color:var(--text)">Quick Capture</span>' +
        '<button onclick="_qcCropToggle()" style="border:1px solid ' + (_qcCropOn() ? '#2980b9' : 'var(--border)') + ';background:' + (_qcCropOn() ? 'rgba(41,128,185,0.15)' : 'var(--surface2)') + ';color:' + (_qcCropOn() ? '#2980b9' : 'var(--text-dim)') + ';border-radius:7px;font-size:0.7rem;font-weight:700;padding:0.25rem 0.6rem;cursor:pointer;font-family:var(--font-body)">Crop each photo: ' + (_qcCropOn() ? 'ON' : 'OFF') + '</button>' +
      '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4rem;min-height:0">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1.5rem;color:var(--text);text-align:center">' + counter + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-dim);min-height:1.2em;text-align:center">' + (pend || (_qc.total ? _qc.total + ' photo' + (_qc.total > 1 ? 's' : '') + ' in your inbox' : 'Photos upload as you go')) + '</div>' +
      '</div>' +
      strip +
      '<button onclick="_qcTake(true)" style="width:100%;min-height:21vh;border-radius:16px;border:none;background:#2980b9;color:#fff;font-family:var(--font-body);font-weight:700;font-size:1.1rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.45rem;margin-bottom:0.6rem">' +
        '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
        'Photo of New Item' +
      '</button>' +
      '<button onclick="_qcTake(false)" ' + (_qc.shots ? '' : 'disabled ') + 'style="width:100%;min-height:12vh;border-radius:16px;border:1.5px solid ' + (_qc.shots ? '#2980b9' : '#8b8e94') + ';background:rgba(41,128,185,' + (_qc.shots ? '0.14' : '0.05') + ');color:' + (_qc.shots ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-body);font-weight:700;font-size:1rem;cursor:pointer;margin-bottom:0.6rem;opacity:' + (_qc.shots ? '1' : '0.55') + '">Another Photo of Same Item</button>' +
      '<button onclick="_qcDone()" style="width:100%;padding:0.8rem;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.9rem;cursor:pointer">Done</button>';
  }

  // Both big buttons funnel here: newItem=true starts the next group.
  window._qcTake = function (newItem) {
    if (!_qc) return;
    _qc.nextIsNew = !!newItem;
    var inp = document.getElementById('qc-file');
    if (inp) inp.click();
  };

  function _qcShot(file) {
    if (_qc.nextIsNew && _qc.shots > 0) { _qc.group++; _qc.shots = 0; }
    _qc.nextIsNew = false;
    var go = function (finalFile) {
      _qc.shots++;
      _qc.total++;
      var ext = ((finalFile.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5) || 'jpg';
      var name = 'INBOX ' + _qc.base + ' g' + _qc.base + '-' + _qc.group + ' p' + _qc.shots + '.' + ext;
      var rec = { url: URL.createObjectURL(finalFile), name: name, driveId: null, group: _qc.group };
      _qc.recent.push(rec);
      if (_qc.recent.length > 12) { var old = _qc.recent.shift(); try { URL.revokeObjectURL(old.url); } catch (e) {} }
      _qcUpload(finalFile, name, rec);
      _qcRender();
    };
    // Optional crop-before-upload (photo-crop.js's shared helper; falls back
    // to the original photo on Cancel or if the crop tool isn't loaded).
    if (_qcCropOn() && typeof window._cropFirst === 'function') window._cropFirst(file, go);
    else go(file);
  }

  async function _qcUpload(file, name, rec) {
    _qc.pending++;
    _qcRender();
    try {
      if (!_qcToken()) throw new Error('signed out');
      var fid = await _folder();
      var res = await driveUploadFile(file, name, fid);
      if (rec && res && res.id) rec.driveId = res.id;
    } catch (e) {
      console.warn('[QuickCapture] upload failed:', e);
      _qc.failed.push({ file: file, name: name, rec: rec });
    } finally {
      _qc.pending--;
      _qcRender();
    }
  }

  window._qcRetry = function () {
    if (!_qc || !_qc.failed.length) return;
    var again = _qc.failed.splice(0);
    again.forEach(function (it) { _qcUpload(it.file, it.name, it.rec); });
  };

  // ── Review a recent shot: big view + re-crop/rotate in place ─
  window._qcReview = function (idx) {
    var r = _qc && _qc.recent[idx];
    if (!r) return;
    var old = document.getElementById('qc-review-ov'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'qc-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100005;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;padding:max(0.8rem,env(safe-area-inset-top)) 0.9rem max(0.8rem,env(safe-area-inset-bottom))';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;color:#fff;margin-bottom:0.5rem">' +
        '<strong style="font-size:0.95rem">Item ' + r.group + '</strong>' +
        '<button onclick="document.getElementById(\'qc-review-ov\').remove()" style="background:none;border:none;color:#bbb;font-size:1.5rem;line-height:1;cursor:pointer;padding:0.2rem 0.4rem">✕</button>' +
      '</div>' +
      '<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center"><img src="' + r.url + '" style="max-width:100%;max-height:100%;border-radius:10px" alt=""></div>' +
      '<div style="display:flex;gap:0.6rem;margin-top:0.7rem">' +
        '<button onclick="_qcRecrop(' + idx + ')" style="flex:1;padding:0.85rem;border-radius:10px;border:none;background:#2980b9;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer">Crop / Rotate</button>' +
        '<button onclick="document.getElementById(\'qc-review-ov\').remove()" style="flex:1;padding:0.85rem;border-radius:10px;border:1px solid #555;background:#2a2a2a;color:#eee;font-family:var(--font-body);font-weight:600;font-size:0.95rem;cursor:pointer">Looks good</button>' +
      '</div>';
    document.body.appendChild(ov);
  };

  window._qcRecrop = function (idx) {
    var r = _qc && _qc.recent[idx];
    if (!r) return;
    if (typeof window._openCropper !== 'function') { showToast('Crop tool still loading — try again in a moment', 2500, true); return; }
    var rv = document.getElementById('qc-review-ov'); if (rv) rv.remove();
    window._openCropper(r.url, async function (blob) {
      try { URL.revokeObjectURL(r.url); } catch (e) {}
      r.url = URL.createObjectURL(blob);
      _qcRender();
      // Replace the uploaded Drive file's bytes in place (photo-crop.js pattern).
      if (r.driveId && _qcToken()) {
        try {
          var resp = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + r.driveId + '?uploadType=media', {
            method: 'PATCH', headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'image/jpeg' }, body: blob
          });
          showToast(resp.ok ? 'Photo updated' : 'Crop saved locally — inbox copy may be the original', 2500);
        } catch (e) { console.warn('[QuickCapture] recrop replace:', e); showToast('Could not update the uploaded copy', 2500, true); }
      } else {
        showToast('Photo is still uploading — crop it again in a few seconds if it looks wrong in the inbox', 3000);
      }
    });
  };

  // v0.9.1325: async because the two native confirm() dialogs became
  // appConfirm (see the note on _pinDiscard — a native dialog freezes the
  // extension bridge, and this file's own _pinConfirm comment says so).
  // Every caller invokes this from an onclick and ignores the return value,
  // so returning a promise changes nothing for them.
  window._qcDone = async function () {
    if (_qc && _qc.pending > 0) {
      if (!(await appConfirm(_qc.pending + ' photo' + (_qc.pending > 1 ? 's are' : ' is')
            + ' still uploading. Leave anyway? ' + (_qc.pending > 1 ? 'They' : 'It') + ' may not reach the inbox.',
            { title: 'Still uploading', ok: 'Leave anyway', cancel: 'Wait', danger: true }))) return;
    }
    if (_qc && _qc.failed.length) {
      if (!(await appConfirm(_qc.failed.length + ' photo' + (_qc.failed.length > 1 ? 's' : '')
            + ' failed to upload and will be lost. Close anyway?',
            { title: 'Uploads failed', ok: 'Close anyway', cancel: 'Go back', danger: true }))) return;
    }
    var total = _qc ? (_qc.total - _qc.failed.length) : 0;
    if (_qc) _qc.recent.forEach(function (r) { try { URL.revokeObjectURL(r.url); } catch (e) {} });
    var rv = document.getElementById('qc-review-ov'); if (rv) rv.remove();
    var ov = document.getElementById('qc-ov');
    if (ov) ov.remove();
    if (window.BackStack && BackStack.pop) BackStack.pop('qc-ov');
    _qc = null;
    if (total > 0) showToast(total + ' photo' + (total > 1 ? 's' : '') + ' in your inbox — file them at the desk', 3500);
  };

  // ── Batch Add — lives in the Add-to-My-Collection wizard footer,
  //    to the right of Cancel, first step only (Brad's placement).
  //    Phone → Quick Capture camera; desktop → Photo Inbox page.
  window._qcBatchAdd = function () {
    try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
    if (window.IS_MOBILE_UA) window._qcOpen();
    else window._pinGo(document.getElementById('nav-photo-inbox'));
  };

  function _batchBtnSync() {
    // Batch Add moved to the +Add menu ("Batch Add Photos") — it's no longer a
    // wizard-footer button. Remove any stray instance; never create one.
    var btn = document.getElementById('qc-batch-btn');
    if (btn) btn.remove();
  }

  // Piggyback on dashboard rebuilds (fires after login and after every
  // wizard save) — inject the sidebar entry and flush pending links —
  // and on wizard step renders — keep the Batch Add button in sync.
  var _startupCounted = false;
  function _hook() {
    if (typeof window.buildDashboard === 'function' && !window.buildDashboard._pinWrapped) {
      _registerDashEntries();
      var orig = window.buildDashboard;
      window.buildDashboard = function () {
        try { _autoPlaceOnce(); } catch (e) {}
        var r = orig.apply(this, arguments);
        try {
          _injectNav(); _flushPending(); _repairMissingPhotoLinks(); _backfillMasterKeys();
          if (!_startupCounted) { _startupCounted = true; setTimeout(function () { _pinCountRefresh(); }, 1500); }
        } catch (e) {}
        return r;
      };
      window.buildDashboard._pinWrapped = true;
    } else if (typeof window.buildDashboard !== 'function') {
      setTimeout(_hook, 800);
      return;
    }
    if (typeof window.renderWizardStep === 'function' && !window.renderWizardStep._pinWrapped) {
      var origR = window.renderWizardStep;
      window.renderWizardStep = function () {
        var r = origR.apply(this, arguments);
        try { _batchBtnSync(); } catch (e) {}
        return r;
      };
      window.renderWizardStep._pinWrapped = true;
    }
  }
  _hook();
  // The phone bottom bar is static HTML — give it its Inbox button right
  // away (the sidebar half of _injectNav waits for login harmlessly).
  try { _injectNav(); } catch (e) {}
})();
