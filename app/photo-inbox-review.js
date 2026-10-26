// ═══════════════════════════════════════════════════════════════
// photo-inbox-review.js — the Photo Inbox's review card
//
// Moved WORD FOR WORD out of photo-inbox.js on 2026-10-20 (Photo Inbox split,
// step 4 of PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md — Brad: "go now"). Nothing
// in it changed: the card's order and arrows (inside a group and across the
// inbox), the photo view slots, the card itself (window._pinReview and its
// buttons), the read line, the alternatives, the family pick and the kin panel.
//
// One of the Photo Inbox's pieces: it loads right after photo-inbox-reader.js
// and meets the other pieces only through window._pinShared (PIN — the shared
// values) and window._pinFns (PINF — the hand-over), both made by
// photo-inbox.js. The window._pin… entry points defined here are unchanged.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';
  var PIN = window._pinShared;   // the shared values — made by photo-inbox.js, which loads first
  var PINF = window._pinFns;     // the hand-over — made by photo-inbox.js
  // From app/photo-inbox.js:
  var _pinVisibleGroups = PINF.from('_pinVisibleGroups');
  var _pinOnScreenFid = PINF.from('_pinOnScreenFid');
  var _pinIsMultiPiece = PINF.from('_pinIsMultiPiece');
  var _pinGroupNums = PINF.from('_pinGroupNums');
  var _pinSetGuess = PINF.from('_pinSetGuess');
  var _pinKindLabel = PINF.from('_pinKindLabel');
  var _pinWatchSoon = PINF.from('_pinWatchSoon');
  var _pinMetaSet = PINF.from('_pinMetaSet');
  var _pinKind = PINF.from('_pinKind');
  var _pinOffline = PINF.from('_pinOffline');
  var _pinBusyBounce = PINF.from('_pinBusyBounce');
  var _ids = PINF.from('_ids');
  var _idsSave = PINF.from('_idsSave');
  var _selGroups = PINF.from('_selGroups');
  var _pinReadFile = PINF.from('_pinReadFile');
  var _pinRecFor = PINF.from('_pinRecFor');
  var _pinReadFid = PINF.from('_pinReadFid');
  var _pinFilesToRead = PINF.from('_pinFilesToRead');
  var _pinAr = PINF.from('_pinAr');
  var _tokLine = PINF.from('_tokLine');
  var _pinLensBannerHtml = PINF.from('_pinLensBannerHtml');
  var _pinTagLineHtml = PINF.from('_pinTagLineHtml');
  var _pinHelpSeen = PINF.from('_pinHelpSeen');
  var _pinDemoteAdd = PINF.from('_pinDemoteAdd');
  var _pinRvMarkCurrent = PINF.from('_pinRvMarkCurrent');
  var _pinWhyHtml = PINF.from('_pinWhyHtml');
  var _rvPrefer = PINF.from('_rvPrefer');
  var _pinDemotedRow = PINF.from('_pinDemotedRow');
  // From app/photo-inbox-reader.js:
  var _numberFromText = PINF.from('_numberFromText');
  var _prefEras = PINF.from('_prefEras');
  // Handed over to the other pieces (function declarations are hoisted):
  Object.assign(PINF, { _pinRowFromWords: _pinRowFromWords, _pinKinPanelHtml: _pinKinPanelHtml, _pinAiLine: _pinAiLine, _pinRvNavRefresh: _pinRvNavRefresh, _pinFamilyPick: _pinFamilyPick, _pinKinRowsFor: _pinKinRowsFor });

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
    if (PIN._rvOrderKeys) {
      var by = {};
      PIN._groups.forEach(function (g) { by[g.key] = g; });
      var out = [];
      PIN._rvOrderKeys.forEach(function (k) { if (by[k]) out.push(by[k]); });
      if (out.length) return out;
    }
    return _pinVisibleGroups();
  }

  function _pinRvIndex() {
    if (!PIN._rvKey) return -1;
    var ord = _pinRvOrder();
    for (var i = 0; i < ord.length; i++) if (ord[i].key === PIN._rvKey) return i;
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
      if (!PIN._rvGroups || PIN._rvGroups.length !== 1) return null;   // multi-select card
      var g = PIN._rvGroups[0];
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
  // v0.9.1494 (Brad: "the warning needs to be right above the arrow and
  // should have the add-group background and text color"): an orange pill
  // anchored above the arrow that was pressed, not a bottom toast.
  function _rvEdgeNotice(delta) {
    try {
      var old = document.getElementById('rv-edge-note'); if (old) old.remove();
      var nav = document.getElementById('pin-rv-nav');
      var btns = nav ? nav.querySelectorAll('button') : null;
      var btn = (btns && btns.length) ? (delta > 0 ? btns[btns.length - 1] : btns[0]) : null;
      var d = document.createElement('div');
      d.id = 'rv-edge-note';
      d.textContent = delta > 0
        ? 'Leaving this group\u2019s photos \u2014 hit \u203a again to continue'
        : 'Leaving this group\u2019s photos \u2014 hit \u2039 again to go back';
      d.style.cssText = 'position:fixed;z-index:100012;background:var(--accent,#e8401c);color:#fff;font-family:var(--font-body,sans-serif);font-size:0.8rem;font-weight:600;padding:0.5rem 0.75rem;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,0.45);white-space:nowrap';
      document.body.appendChild(d);
      if (btn) {
        var r = btn.getBoundingClientRect();
        var left = Math.min(Math.max(8, r.right - d.offsetWidth), window.innerWidth - d.offsetWidth - 8);
        var top = r.top - d.offsetHeight - 8;
        if (top < 8) top = r.bottom + 8;
        d.style.left = left + 'px';
        d.style.top = top + 'px';
      } else { d.style.left = '50%'; d.style.top = '20%'; d.style.transform = 'translateX(-50%)'; }
      setTimeout(function () { try { d.remove(); } catch (e) {} }, 3500);
    } catch (e) { try { showToast('Leaving this group\u2019s photos \u2014 hit the arrow again to continue', 3000); } catch (e2) {} }
  }
  function _rvEdgeNoteKill() { try { var n = document.getElementById('rv-edge-note'); if (n) n.remove(); } catch (e) {} }
  var _rvEdgeArmed = 0;   // v0.9.1493: the leaving-group two-press latch (+1 fwd / -1 back)
  window._pinReviewStepMember = function (delta) {
    var fl = _pinRvMembers();
    if (!fl) return;
    var i = _pinRvMemberIndex(), j = i + delta;
    if (j < 0 || j >= fl.length) {
      // ── v0.9.1493 (Brad: "we should be able to keep going in either
      // direction... put a pop up that says 'leaving group/set photos. hit
      // arrow again to continue'"): first press at the edge ARMS and says
      // so; the second press in the same direction steps OUT to the next /
      // previous card in the inbox. A press the other way disarms.
      if (_rvEdgeArmed === delta) {
        _rvEdgeArmed = 0;
        if (typeof window._pinReviewStep === 'function') window._pinReviewStep(delta);
        return;
      }
      _rvEdgeArmed = delta;
      _rvEdgeNotice(delta);   // v0.9.1494: orange pill above the pressed arrow
      return;
    }
    _rvEdgeArmed = 0;
    _rvEdgeNoteKill();
    window._pinRvSetMain(fl[j].id);   // redraws the arrows and the counter (_pinRvNavRefresh)
  };
  // The arrows and the counter describe the photo on screen, so they are redrawn
  // whenever it changes — otherwise "2 of 6" freezes and the greying lies at the
  // ends. v0.9.1960: from _pinRvSetMain, so a TAPPED photo updates them too (only
  // the arrows did), now that the photo on screen is the one every button uses.
  function _pinRvNavRefresh() {
    try {
      if (!_pinRvMembers()) return;
      var hd = document.getElementById('pin-rv-nav');
      if (hd && hd.children.length >= 4) {
        hd.children[0].outerHTML = _pinRvNavHtml('prev');
        hd.children[2].outerHTML = _pinRvPosHtml();
        hd.children[3].outerHTML = _pinRvNavHtml('next');
      }
    } catch (eN) {}
  }

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
      // v0.9.1493: live at the edges too — the edge press arms the
      // leaving-group latch instead of dead-ending.
      return _pinRvArrow(dir, true,
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
    var g = (PIN._rvGroups && PIN._rvGroups.length === 1) ? PIN._rvGroups[0] : null;
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
    _rvEdgeArmed = 0;   // v0.9.1493: a card change always disarms the latch
    _rvEdgeNoteKill();
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
    PIN._rvOrderKeys = null;         // v0.9.1307: next opening snapshots fresh
    // v0.9.1704: the card was the thing holding the inbox watcher still, so
    // whatever the phone did while it was open can show now.
    try { _pinWatchSoon('card closed', 400); } catch (eW) {}
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
    if (!PIN._rvGroups || PIN._rvGroups.length !== 1) return;
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
        var ids = PIN._rvGroups[0].files.map(function (f) { return f.id; });
        var fi = ids.indexOf(from), ti = ids.indexOf(to);
        if (fi < 0 || ti < 0) return;
        ids.splice(ti, 0, ids.splice(fi, 1)[0]);
        window._pinSaveRvOrder(ids);
      };
    });
  }

  window._pinSaveRvOrder = async function (orderedFids) {
    var g = PIN._rvGroups && PIN._rvGroups.length === 1 && PIN._rvGroups[0];
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
    try { window._pinReview(PIN._rvKey || (g && g.key)); } catch (e) {}
  };

  // v0.9.1325: `only` lets a caller name the groups OUTRIGHT instead of
  // staging them in the shared `_sel` map. Three review-card helpers used to
  // do the latter — see the note on _pinReviewDiscard — which left photos
  // ticked INVISIBLY after the card closed, because the tick circle is only
  // drawn in select mode while the toolbar arms Discard and Identify on the
  // COUNT alone. An explicit argument cannot leak.
  // ═══ v0.9.1616 (Brad): VIEW SLOTS ON THE REVIEW CARD ═════════════════
  // "on grouped items, we need to have the photo slots for each view like
  // right side, left side, top, bottom, front, back, and detail 1 detail 2
  // … so that we can move the pictures into the correct slot before we add
  // the item." The stamps were always the wizard's dealing order
  // (_pinMetaOf(f).view → the v1440 slot deal) — what was missing was a
  // surface to SET them here. Tap a slot → pick which photo it is; if that
  // photo held another slot and this one was occupied, the two stamps SWAP
  // (the same rule as the wizard's v1614 drag). Stamps are Drive
  // appProperties, so they need a connection for uploaded photos — a
  // failure says so and changes nothing on screen.
  var _RV_SLOTS = [
    { key: 'TV',     label: 'Top' },
    { key: 'LSV',    label: 'Left Side' },
    { key: 'FV',     label: 'Front' },
    { key: 'RSV',    label: 'Right Side' },
    { key: 'BKV',    label: 'Back' },
    { key: 'BV',     label: 'Bottom' },
    { key: 'EXTRA',  label: 'Detail 1' },
    { key: 'EXTRA2', label: 'Detail 2' },
  ];
  function _pinRvFiles() {
    var out = [];
    (PIN._rvGroups || []).forEach(function (g) { (g.files || []).forEach(function (f) { out.push(f); }); });
    return out;
  }
  function _pinRvViewOf(f) { return (f && f._meta && f._meta.view) || ''; }
  // v0.9.1618 (Brad's engine+tender): a PAIR group gets one slot row PER
  // PIECE — the roles set at grouping time (engine / tender / A-unit …) ARE
  // the folders he described, so the bar sections by them, plus a single
  // "together" slot for the shot of both. Assigning across rows moves the
  // photo to that piece (role and view travel together — the same two
  // stamps the wizard has dealt by since v1440). Train SETS keep the flat
  // bar: their roles are car types, and members split by number at add
  // time — per-type slot rows would be noise, not order.
  function _pinRvRoleSections() {
    if (!PIN._rvGroups || PIN._rvGroups.length !== 1) return null;
    var g = PIN._rvGroups[0];
    var kindId = g.kind || (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || 'single';
    if (kindId === 'single' || kindId === 'paper' || kindId === 'set') return null;
    var k = _pinKind(kindId);
    if (!k.roles || !k.roles.length) return null;
    return k.roles;   // [['engine','Engine'],['tender','Tender'],['together','Both together']]
  }
  function _pinRvRoleOf(f) { return (f && f._meta && f._meta.role) || ''; }
  function _pinRvSlotCell(sl, f, roleKey) {
    var dropJs = 'event.preventDefault();event.stopPropagation();this.style.outline=\'\';var f=event.dataTransfer.getData(\'text/plain\');if(f)_pinRvAssignView(f,\'' + sl.key + '\'' + (roleKey ? ',\'' + roleKey + '\'' : '') + ')';
    // v0.9.1619 (Brad: "need to be able to drag pictures between different
    // views when I get the wrong [slot]. right now i can drag down but not
    // from view to view"). v1617 made slots drop TARGETS only — a photo
    // already in a slot had no way to START a drag. A filled slot now
    // carries its fid on text/plain, the rail's own protocol, so a drop on
    // any other slot lands in the ONE assign handler (_pinRvAssignView) and
    // every rule — swap on occupied, cross-piece re-file, the together
    // slot — comes for free. Mouse = HTML5 drag; touch = the v1614
    // press-and-hold below (HTML5 drag never fires on a touch screen).
    // The INTERNAL stamp keeps the import drop zone from ever reading this
    // drag as a new-photo upload.
    var dragJs = f
      ? ' draggable="true"' +
        ' ondragstart="event.dataTransfer.setData(\'text/plain\',\'' + f.id + '\');event.dataTransfer.effectAllowed=\'move\';window._pinInternalDrag=true;this.style.opacity=\'0.45\'"' +
        ' ondragend="window._pinInternalDrag=false;this.style.opacity=\'\'"' +
        ' onpointerdown="_pinRvSlotDragTouch(event,this)"'
      : '';
    return '<div data-rvslot="' + sl.key + '" data-rvrole="' + (roleKey || '') + '"' + (f ? ' data-slotfid="' + f.id + '"' : '') + dragJs +
      ' onclick="_pinRvSlotTap(\'' + sl.key + '\'' + (roleKey ? ',\'' + roleKey + '\'' : '') + ')"' +
      ' ondragover="event.preventDefault();this.style.outline=\'2px solid var(--accent)\'"' +
      ' ondragleave="this.style.outline=\'\'"' +
      ' ondrop="' + dropJs + '"' +
      ' title="' + (f ? 'Tap the picture to show it; tap the label to choose which photo is the ' : 'Tap to choose which photo is the ') + sl.label + ' — or drag a photo here" style="flex:0 0 auto;width:56px;cursor:pointer;text-align:center">' +
      (f
        // v0.9.1705 (Brad: "tap the pictures in the small boxes that have the
        // view labels to select the picture i want to edit"): the PICTURE in a
        // filled slot makes that photo the current one — it left the rail when
        // it was slotted (v1617), so this box is the only place to tap it. The
        // label beneath still opens the which-photo picker, as does an empty box.
        ? '<div data-slotpic="' + f.id + '" onclick="event.stopPropagation();_pinRvSetMain(\'' + f.id + '\')" style="width:56px;height:48px;border-radius:8px;overflow:hidden;border:1.5px solid var(--accent2);background:var(--surface2)"><img data-rvv="' + f.id + '" class="rr-fit" style="width:100%;height:100%;display:block" alt=""></div>'
        : '<div style="width:56px;height:48px;border-radius:8px;border:1.5px dashed var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:1rem">+</div>') +
      '<div style="font-size:0.55rem;font-weight:700;color:' + (f ? 'var(--text)' : 'var(--text-dim)') + ';letter-spacing:0.02em;margin-top:2px;white-space:nowrap">' + sl.label + '</div>' +
    '</div>';
  }
  // ── v0.9.1619: TOUCH drag between slots — press-and-hold, then drag ──
  // The v1614 wizard pattern applied to the slot bar: hold 300ms (an early
  // move >10px means a scroll — cancelled), a ghost chip follows the
  // finger, the slot underneath highlights, and lifting on a slot hands
  // the fid to _pinRvAssignView — the same one handler the tap picker and
  // the rail drop use. A quick tap still opens the picker.
  var _rvtd = null;
  window._pinRvSlotDragTouch = function (e, div) {
    if (e.pointerType === 'mouse') return;   // mouse uses HTML5 drag above
    if (_rvtd) return;
    var fid = div.getAttribute('data-slotfid');
    if (!fid) return;
    var sx = e.clientX, sy = e.clientY;
    var st = { dragging: false, ghost: null, over: null, hold: null };
    _rvtd = st;
    function clean() {
      try { document.removeEventListener('pointermove', onMove); } catch (e2) {}
      try { document.removeEventListener('pointerup', onUp); } catch (e2) {}
      try { document.removeEventListener('pointercancel', onUp); } catch (e2) {}
      try { document.removeEventListener('touchmove', blockScroll, { passive: false }); } catch (e2) {}
      if (st.hold) clearTimeout(st.hold);
      if (st.ghost) try { st.ghost.remove(); } catch (e2) {}
      if (st.over) try { st.over.style.outline = ''; } catch (e2) {}
      try { div.style.opacity = ''; } catch (e2) {}
      _rvtd = null;
    }
    function blockScroll(ev) { if (st.dragging) ev.preventDefault(); }
    function onMove(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!st.dragging) {
        if ((dx * dx + dy * dy) > 100) clean();   // moved before the hold — a scroll
        return;
      }
      if (st.ghost) { st.ghost.style.left = (ev.clientX - 28) + 'px'; st.ghost.style.top = (ev.clientY - 60) + 'px'; }
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      var cell = el && el.closest ? el.closest('[data-rvslot]') : null;
      if (cell === div) cell = null;
      if (st.over && st.over !== cell) { st.over.style.outline = ''; st.over = null; }
      if (cell && cell !== st.over) { st.over = cell; cell.style.outline = '2px solid var(--accent)'; }
    }
    function onUp() {
      if (st.dragging && st.over) {
        var v = st.over.getAttribute('data-rvslot') || '';
        var r = st.over.getAttribute('data-rvrole') || '';
        clean();
        window._pinRvAssignView(fid, v, r || undefined);
        return;
      }
      clean();
    }
    st.hold = setTimeout(function () {
      st.dragging = true;
      try { div.style.opacity = '0.45'; } catch (e2) {}
      try {
        var g = document.createElement('div');
        g.id = 'pin-rv-drag-ghost';
        g.textContent = '\u21c6 drop on another slot to move it';
        g.style.cssText = 'position:fixed;z-index:100090;left:' + (sx - 28) + 'px;top:' + (sy - 60) + 'px;'
          + 'background:var(--surface);color:var(--text);border:1.5px solid var(--accent);border-radius:999px;'
          + 'padding:0.35rem 0.8rem;font-family:var(--font-body);font-weight:700;font-size:0.75rem;'
          + 'pointer-events:none;box-shadow:0 4px 16px var(--scrim)';
        document.body.appendChild(g);
        st.ghost = g;
      } catch (e2) {}
      document.addEventListener('touchmove', blockScroll, { passive: false });
    }, 300);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };
  function _pinRvViewsBarHtml() {
    var files = _pinRvFiles();
    if (files.length < 2) return '';   // one photo has nothing to sort
    var sections = _pinRvRoleSections();
    if (sections) {
      // one row per piece + the together slot
      var html = '<div id="pin-rv-views" style="margin-bottom:0.7rem">';
      sections.forEach(function (ro) {
        var rKey = ro[0], rLabel = ro[1];
        if (rKey === 'together') return;   // rendered once, after the pieces
        var byV = {};
        files.forEach(function (f) { if (_pinRvRoleOf(f) === rKey) { var v = _pinRvViewOf(f); if (v && !byV[v]) byV[v] = f; } });
        html += '<div style="font-size:0.62rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-mid);margin:0.35rem 0 0.15rem">' + rrEsc(rLabel) + '</div>' +
          '<div style="display:flex;gap:0.35rem;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0.1rem 0">' +
          _RV_SLOTS.map(function (sl) { return _pinRvSlotCell(sl, byV[sl.key], rKey); }).join('') +
          '</div>';
      });
      var tog = null;
      files.forEach(function (f) { if (!tog && _pinRvRoleOf(f) === 'together') tog = f; });
      html += '<div style="font-size:0.62rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-mid);margin:0.35rem 0 0.15rem">Both together</div>' +
        '<div style="display:flex;gap:0.35rem;padding:0.1rem 0">' +
        _pinRvSlotCell({ key: '', label: 'Set shot' }, tog, 'together') +
        '</div></div>';
      return html;
    }
    var byView = {};
    files.forEach(function (f) { var v = _pinRvViewOf(f); if (v && !byView[v]) byView[v] = f; });
    return '<div id="pin-rv-views" style="display:flex;gap:0.35rem;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:0.7rem;padding:0.15rem 0">' +
      _RV_SLOTS.map(function (sl) {
        var f = byView[sl.key];
        // v0.9.1617 (Brad: "need to add the drag option here as well"): a
        // rail thumb can be DROPPED straight onto a slot — the rail's own
        // reorder drag already carries the fid as text/plain.
        return _pinRvSlotCell(sl, f, '');
      }).join('') +
    '</div>';
  }
  window._pinRvSlotTap = function (viewKey, roleKey) {
    var files = _pinRvFiles();
    if (!files.length) return;
    var sl = null;
    for (var i = 0; i < _RV_SLOTS.length; i++) if (_RV_SLOTS[i].key === viewKey) sl = _RV_SLOTS[i];
    var holder = null;
    files.forEach(function (f) {
      // v0.9.1618: in a sectioned bar a slot is held per PIECE — the
      // together slot is held by role alone (it carries no view).
      if (roleKey === 'together') { if (_pinRvRoleOf(f) === 'together') holder = f; return; }
      if (_pinRvViewOf(f) === viewKey && (!roleKey || _pinRvRoleOf(f) === roleKey)) holder = f;
    });
    var old = document.getElementById('pin-rv-slotpick'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-rv-slotpick';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100075;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1rem;width:100%;max-width:420px;max-height:80vh;max-height:80dvh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">' +
          '<strong style="color:var(--text);font-size:0.95rem">Which photo is the ' + (sl ? sl.label : viewKey) + '?</strong>' +
          '<button onclick="document.getElementById(\'pin-rv-slotpick\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer">✕</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:0.45rem">' +
          files.map(function (f) {
            var v = _pinRvViewOf(f);
            var vLbl = '';
            for (var j = 0; j < _RV_SLOTS.length; j++) if (_RV_SLOTS[j].key === v) vLbl = _RV_SLOTS[j].label;
            return '<div onclick="_pinRvAssignView(\'' + f.id + '\',\'' + viewKey + '\'' + (roleKey ? ',\'' + roleKey + '\'' : '') + ')" style="cursor:pointer;position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:2px solid ' + (v === viewKey ? 'var(--accent)' : 'var(--border)') + ';background:var(--surface2)">' +
              '<img data-rvv="' + f.id + '" class="rr-fit" style="width:100%;height:100%;display:block" alt="">' +
              (vLbl ? '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);color:#fff;font-size:0.55rem;font-weight:700;text-align:center;padding:1px 2px">' + vLbl + '</div>' : '') +
            '</div>';
          }).join('') +
        '</div>' +
        (holder
          ? '<button onclick="_pinRvAssignView(\'\',\'' + viewKey + '\'' + (roleKey ? ',\'' + roleKey + '\'' : '') + ')" style="margin-top:0.7rem;width:100%;padding:0.6rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Clear this slot</button>'
          : '') +
      '</div>';
    document.body.appendChild(ov);
    try {
      ov.querySelectorAll('img[data-rvv]').forEach(function (img) {
        loadDriveThumb(img.getAttribute('data-rvv'), img, img.parentElement, PIN._thumbLink[img.getAttribute('data-rvv')] || null, 'hi');
      });
    } catch (eT) {}
  };
  window._pinRvAssignView = async function (fid, viewKey, roleKey) {
    var files = _pinRvFiles();
    var picked = null, holder = null;
    files.forEach(function (f) {
      if (f.id === fid) picked = f;
      if (f.id === fid) return;
      // v0.9.1618: sectioned bars hold slots per piece; the together slot
      // is held by role alone.
      if (roleKey === 'together') { if (_pinRvRoleOf(f) === 'together') holder = f; return; }
      if (_pinRvViewOf(f) === viewKey && (!roleKey || _pinRvRoleOf(f) === roleKey)) holder = f;
    });
    var oldView = picked ? _pinRvViewOf(picked) : '';
    var oldRole = picked ? _pinRvRoleOf(picked) : '';
    var _tog = roleKey === 'together';
    var ok1 = true, ok2 = true;
    try {
      if (picked) {
        // role and view travel together — crossing rows re-files the photo.
        var patch = _tog ? { view: '', role: 'together' } : { view: viewKey };
        if (roleKey && !_tog) patch.role = roleKey;
        ok1 = await _pinMetaSet(picked.id, patch);
      } else if (holder) {
        ok1 = await _pinMetaSet(holder.id, _tog ? { role: oldRole && oldRole !== 'together' ? oldRole : '' } : { view: '' });   // Clear this slot
      }
      // Brad's swap rule: the displaced photo takes the mover's old place —
      // BOTH stamps, so a cross-piece swap is a true trade.
      if (picked && holder) {
        var back = _tog ? { view: oldView || '', role: oldRole || '' } : { view: oldView || '' };
        if (roleKey && !_tog) back.role = oldRole || roleKey;
        ok2 = await _pinMetaSet(holder.id, back);
      }
    } catch (e) { ok1 = false; }
    if (!ok1 || !ok2) {
      showToast(_pinOffline()
        ? 'You’re offline — view labels for uploaded photos need a connection. Nothing was changed.'
        : 'Could not save that view label — try again.', 4200, true);
      return;
    }
    // reflect in the cached meta so the card repaints truthfully at once
    if (picked) { picked._meta = picked._meta || {}; picked._meta.view = _tog ? '' : viewKey; if (roleKey) picked._meta.role = _tog ? 'together' : roleKey; }
    if (picked && holder) { holder._meta = holder._meta || {}; holder._meta.view = _tog ? (oldView || '') : (oldView || ''); if (roleKey) holder._meta.role = oldRole || (_tog ? '' : roleKey); }
    // v0.9.1623 (Brad: "the second one disappeared"): dropping an unplaced
    // photo on an occupied slot swaps — and the displaced photo, inheriting
    // no view, returns to the rail. Correct, but it read as a vanishing.
    // Say it the one time it surprises; a clean swap stays quiet.
    if (picked && holder && !_tog && !oldView) {
      try { showToast('Swapped — the photo that held that slot went back to the photo rail', 3800); } catch (eT) {}
    }
    if (!picked && holder) { holder._meta = holder._meta || {}; if (_tog) holder._meta.role = ''; else holder._meta.view = ''; }
    var pk = document.getElementById('pin-rv-slotpick'); if (pk) pk.remove();
    try { PIN._rvStayOn = _pinOnScreenFid(); } catch (eS) {}   // v0.9.1960: no jump back to the first photo
    try { window._pinReview(PIN._rvKey || '', PIN._rvGroups); } catch (e) {}
  };

  // ── v0.9.1960 — discard ONE leftover photo from the card ──
  // Brad: "need a way to delete extra group pictures when you move the photos
  // to the orientation boxes like right side and have 1 or 2 left over". The
  // same Drive trash the Discard button uses (recoverable about 30 days), the
  // same styled confirm — for one photo, and the card stays open on the rest.
  window._pinRvDiscardOne = async function (fid) {
    if (!fid) return;
    if (PIN._busy) { _pinBusyBounce(); return; }
    if (!(await appConfirm('Discard this photo? It goes to your Google Drive trash, recoverable for about 30 days.',
          { title: 'Discard photo', ok: 'Discard', cancel: 'Keep it', danger: true }))) return;
    try {
      await driveRequest('PATCH', '/files/' + fid, { trashed: true });
    } catch (e) {
      showToast(_pinOffline() ? 'You’re offline — discarding needs a connection. Nothing was changed.' : 'Could not discard that photo — try again.', 4200, true);
      return;
    }
    var onScreen = _pinOnScreenFid();
    var drop = function (list) { (list || []).forEach(function (g) { if (g && g.files) g.files = g.files.filter(function (f) { return f && f.id !== fid; }); }); };
    drop(PIN._rvGroups); drop(PIN._groups);
    try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (eI) {}
    var left = 0; (PIN._rvGroups || []).forEach(function (g) { left += (g.files || []).length; });
    showToast('Discarded 1 photo', 2200);
    if (!left) {
      var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    } else {
      PIN._rvStayOn = onScreen !== fid ? onScreen : '';
      try { window._pinReview(PIN._rvKey || '', PIN._rvGroups); } catch (eR) {}
    }
    try { window._pinRefresh(); } catch (eF) {}
  };

  // ══ v0.9.1943 — the laptop card's photo takes the room the buttons leave ══
  // The laptop card (1200px and up) runs the photo across the top at up to its
  // 40vh cap. On a shorter screen — Brad's laptop, where pop-ups are shown at
  // 1.5x — photo + buttons can be taller than the card, and the ACT column
  // would scroll and hide buttons. Measure that overflow and take it off the
  // photo instead, never below 120px. The READ column counts too (what the
  // photo said + the catalog details), so they are not cut off either. The
  // cap itself is read back from the photo's own style the first time (one
  // source: the _photoWide line).
  // v0.9.1959 (Brad: "be freaking consistant"): ONE arrangement on the laptop
  // card, whatever the photo's shape — the photo beside the buttons, as tall
  // as its cell allows (less the strip beneath it). v1958 sent very wide shots
  // across the top instead; that exception is gone.
  function _pinRvFitHero() {
    var img = document.getElementById('pin-rv-main'), top = document.getElementById('pin-rv-top');
    if (!img || !top || !document.getElementById('pin-rv-cols')) return;   // the laptop card only
    var box = img.parentElement;
    var strip = document.getElementById('pin-rv-strip');
    var room = top.clientHeight - (strip ? strip.offsetHeight + 8 : 0) - 8;
    var h = Math.max(160, room);
    img.style.maxHeight = h + 'px'; if (box) box.style.maxHeight = h + 'px';
  }
  try { window.addEventListener('resize', _pinRvFitHero); } catch (eRz) {}

  window._pinReview = function (key, only) {
    // v0.9.1735: a pick belongs to ONE photo. Clearing it on every card
    // opening is what stops "I have the Savings Bank one" from silently
    // following him onto the next car.
    try { _rvClearPick(); } catch (ePC) {}
    PIN._rvKey = key || '';          // v0.9.1057: which group the card is showing
    PIN._rvGroups = key ? PIN._groups.filter(function (g) { return g.key === key; })
                    : (only && only.length ? only.slice() : _selGroups());
    if (!PIN._rvGroups.length) { showToast('Select photos first', 2500, true); return; }
    // v0.9.1307: snapshot the walking order ONCE per card-opening — stepping
    // re-enters here with a new key and must keep the same snapshot.
    if (key && !PIN._rvOrderKeys) {
      PIN._rvOrderKeys = _pinVisibleGroups().map(function (g) { return g.key; });
    }
    var n = 0; PIN._rvGroups.forEach(function (g) { n += g.files.length; });
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
    PIN._rvAiMfr = '';
    PIN._rvAiRec = null;
    // v0.9.1960 (Brad: "the highlighted one should be the one sent to google or
    // gets read. if not selected, use right side" — and dropping the last photo
    // into its box made the card jump): the photo on screen is the one you were
    // on when the card repaints itself (a slot drop, a discard); on opening it is
    // the Right Side photo, else the first. Every read button and Google Photo ID
    // use the photo on screen (_pinOnScreenFid), so this is the one rule.
    var _mainFid0 = (function () {
      var all = [];
      PIN._rvGroups.forEach(function (g) { g.files.forEach(function (f) { all.push(f.id); }); });
      var stay = PIN._rvStayOn; PIN._rvStayOn = '';
      if (stay && all.indexOf(stay) >= 0) return stay;
      var lead = _pinReadFile(PIN._rvGroups[0]);
      if (lead && ((lead._meta || {}).view === 'RSV')) return lead.id;
      for (var gi = 0; gi < PIN._rvGroups.length; gi++) {
        var rs = PIN._rvGroups[gi].files.filter(function (f) { return ((f && f._meta) || {}).view === 'RSV'; })[0];
        if (rs) return rs.id;
      }
      return all[0];
    })();
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
      // v0.9.1960: the photo on screen (_mainFid0), through _pinRecFor — so a
      // one-item group opens with the number one of its photos was given.
      var s0 = _pinRecFor(_mainFid0).rec
            || _ids()[_pinReadFid(PIN._rvGroups[0]) || PIN._rvGroups[0].files[0].id];
      if (s0 && s0.num) { if (s0.guess) sugGuess = String(s0.num); else sug = String(s0.num); }
      if (s0 && s0.mfr) PIN._rvAiMfr = String(s0.mfr);
      PIN._rvAiRec = s0 || null;   // v0.9.1419: the conflict check reads the whole record
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
    PIN._rvGroups.forEach(function (g) { g.files.forEach(function (f) { thumbs.push(f.id); }); });
    // v0.9.1617 (Brad): a photo placed in a view slot LEAVES the rail above
    // — it lives in its slot now, so it cannot be pasted twice and the rail
    // shrinks to what still needs sorting. (Double-placing was already
    // impossible at the data level — one photo carries one view stamp — but
    // the rail should SAY so.) When everything is sorted, one thumb stays
    // so the card keeps its anchor and the MAIN VIEW badge means something.
    var _viewOfFid = {};
    PIN._rvGroups.forEach(function (g) { g.files.forEach(function (f) { if (f._meta && f._meta.view) _viewOfFid[f.id] = f._meta.view; }); });
    // v0.9.1960 (Brad: "you get to the last one, the screen flashes and the
    // last one disappears"): the strip used to hide itself when ONE photo was
    // left to sort, so that photo vanished. It now shows while ANY photo is
    // unsorted (in a card of two or more), and goes when all are in boxes.
    var _railThumbs = thumbs.length > 1 ? thumbs.filter(function (t) { return !_viewOfFid[t]; }) : [];
    var _rsvTaken = Object.keys(_viewOfFid).some(function (t) { return _viewOfFid[t] === 'RSV'; });
    // v0.9.913 (Brad): desktop shows a two-column split — details on the left,
    // a big full-res photo filling the right half so you can read the label
    // without a separate zoom. Phone stays stacked (small screen).
    var _wide = !window.IS_MOBILE_UA && (window.innerWidth || 0) >= 900;
    // v0.9.1739 (Brad, on a laptop): "having to scroll up and down to see
    // everything ... can we widen the box and change up somethings to get it
    // to fit without scrolling. The picture is way to big as well." At 1200px
    // and up the card becomes two columns: ACT on the left (photo, number,
    // every button), READ on the right (what the photo said, the catalog, the
    // owned copies, the pick panel). The right column scrolls on its own when
    // a car has nine variations and a mismatch warning; the buttons never
    // move. 900-1199 keeps the stacked wide layout it always had.
    var _wide2 = _wide && (window.innerWidth || 0) >= 1200;
    var _mainFid = _mainFid0;

    // v0.9.963 (Brad): answer-first layout. The read summary + catalog details
    // lead the card in a readable size (that's what you came to see); the number
    // box and actions follow; research helpers sit at the bottom. No emoji.
    // v0.9.969 (Brad): shared button area — number box, then two columns: LEFT
    // the 1×3 "what to do" stack (Add / Sales List / Discard), RIGHT the 2×2
    // "not sure" grid (re-scan / Research Number / Google Photo ID / token read)
    // with the daily token count beneath it. Same block on desktop and phone;
    // the two columns sit side by side when there's room and stack when narrow.
    var _lbl = 'font-size:0.74rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;margin:0 0 0.5rem';
    // ══ v0.9.1943 — ONE place for the size and shape of every button on this card ══
    // Brad, laptop, 2026-10-14: "you can [hardly] even see the photo. scale things
    // down so you get a decent photo to see. all the other text is large. the
    // buttons could be put into a grid". Each button below carries only its
    // COLOURS; its size and shape come from _rvBtn(kind). The laptop card (_wide2)
    // gets the compact size; the phone and the 1000px card keep exactly the sizes
    // they had (the second line of _RV_SIZE is those old numbers, unchanged).
    var _RV_SIZE = _wide2
      // v0.9.1958: the ONE main button stands out. v0.9.1959 (Brad: "scale the
      // buttons back so they are not so gigantic"): about a third smaller, so
      // what the photo said fits under them without scrolling.
      ? { add: 'padding:0.42rem 0.6rem;font-size:0.86rem;', main: 'padding:0.3rem 0.45rem;font-size:0.76rem;', grid: 'padding:0.3rem 0.45rem;font-size:0.76rem;' }
      : { add: 'padding:0.72rem;font-size:0.93rem;', main: 'padding:0.68rem;font-size:0.9rem;', grid: 'padding:0.62rem 0.5rem;font-size:0.82rem;' };
    // the stacked buttons' space between them; in the laptop grid the grid's gap does it
    var _rvStackGap = _wide2 ? '' : 'margin-bottom:0.5rem;';
    function _rvBtn(kind) {
      return (kind === 'grid' ? 'border-radius:9px;' : 'width:100%;border-radius:10px;')
        + 'font-family:var(--font-body);font-weight:700;cursor:pointer;'
        + ((kind === 'grid' || _wide2) ? 'line-height:1.2;' : '') + _RV_SIZE[kind];
    }
    var _gBtn = _rvBtn('grid');
    // Offered, not entered. Tapping it fills the box and runs the lookup, which
    // is the same thing pre-filling did — except the user chose it.
    // v0.9.1833: [stated] Brad — "don't need the 6464 — use this as it adds to
    // the confusion when you have 2 to pick from." With two or more choices
    // on the card the choice IS the guidance; the chip stays only when the
    // reader has one guess and nothing to pick between — then it is the one
    // way to take the guess. _pinAltList is the same list the chips draw.
    var _guessChip = (sugGuess && _pinAltList().length < 2)
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
      _pinFilesToRead(PIN._rvGroups[0]).forEach(function (fS) {
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
    // v0.9.1434 (Brad): the KIND he declared when grouping decides the route
    // — the card stops offering "add the whole set" to an ABA he already
    // named. An ABA/AB/AA/engine+tender is ONE linked item, not a train set;
    // asking again was the inbox throwing away what it knew. Three buttons
    // for a group: collection, sales list, discard. The set evidence line
    // stays (information, not a button), and an UNTAGGED stack whose 2+ read
    // numbers match a real set still routes to the set flow — the one case
    // the old separate button was right.
    var _rvKind = 'single';
    try { _rvKind = (PIN._rvGroups[0] && ((PIN._rvGroups[0].files[0] && PIN._rvGroups[0].files[0]._meta && PIN._rvGroups[0].files[0]._meta.kind) || PIN._rvGroups[0].kind)) || 'single'; } catch (eRK) {}
    var _isGrp = (_rvKind !== 'single') || n > 1;
    var _routeSet = (_rvKind === 'set') || (_rvKind === 'single' && _setNums.length >= 2 && !!_setGuess);
    var _setBtn = _setLine;
    // ══ v0.9.1958 — every button on this card written ONCE ══════════════════
    // Brad, laptop, 2026-10-15: "This is way too big. is so big that i can't
    // see all the buttons as i get lost." The laptop card arranges the SAME
    // buttons differently (below); the phone and the 1000px card keep exactly
    // the arrangement they had. Each button exists in one place only.
    var _addBtn = '<button id="pin-rv-add" onclick="' + (_routeSet ? '_pinAddSetFromGroup()' : '_pinAddItem()') + '" class="btn-primary" style="' + _rvBtn('add') + 'border:none;' + _rvStackGap + '">'
      + ((_routeSet && _setGuess) ? 'Add set ' + rrEsc(_setGuess.setNum) + ' to my collection'
         : (_isGrp ? 'Add group to my collection' : 'Add to my Collection')) + '</button>';
    var _sellBtn = '<button id="pin-rv-sell" onclick="_pinSendForSale()" style="' + _rvBtn('main') + 'border:1.5px solid #d4a843;background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 12%, var(--bg-card));color:var(--t-gold);' + _rvStackGap + '">' + (_isGrp ? 'Add group to my sales list' : 'Add to Sales List') + '</button>';
    // v0.9.1498 (task #28, Brad): photos of an item he ALREADY owns get a door
    // to that copy -- the dormant v0.9.958 attach lane, revived with a copy
    // picker. Direct move, no wizard, no deferred note.
    var _attachBtn = '<button id="pin-rv-attach" onclick="_pinAttachOwnedPick()" style="' + _rvBtn('main') + 'border:1.5px solid #2980b9;background:var(--bg-card);background:color-mix(in srgb, rgb(41,128,185) 12%, var(--bg-card));color:var(--t-link);' + _rvStackGap + '">' + (_isGrp ? 'Add group to an item I already own' : 'Add to an existing item in my collection') + '</button>';
    var _discardTxt = _isGrp ? 'Discard group' : 'Discard Photo' + (n > 1 ? 's' : '');
    var _rescanBtn = '<button id="pin-rv-rescan" onclick="_pinRescan()" title="Forget this read and scan the photo again at higher detail" style="' + _gBtn + 'border:1.5px solid #f05008;background:var(--bg-card);background:color-mix(in srgb, rgb(240,80,8) 10%, var(--bg-card));color:var(--t-red)">This is wrong — re-scan</button>';
    var _researchBtn = '<button onclick="_pinReviewResearch()" style="' + _gBtn + 'border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link)">Research Number</button>';
    var _lensBtn = '<button id="pin-rv-lens" onclick="_pinReviewLens()" style="' + _gBtn + 'border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-link)">Google Photo ID</button>';
    // v0.9.1163: don't quote a price the app will not charge. With reads
    // switched off this button still said "(1 token)" and then reported a
    // failure, which is how Brad ended up thinking it was broken.
    // v0.9.1927: the paid read is a beta feature — no button for everyone else.
    var _tokBtn = (!_pinAr() ? '' :
      '<button id="pin-rv-idtoken" onclick="_pinReviewIdentify()" title="'
        + ((typeof rrAiOptedOut === 'function' && rrAiOptedOut())
            ? 'Photo ID reads are off — turn them on in Preferences › Photo ID'
            : 'Identify this item straight from its photo — uses one photo ID')
        + '" style="' + _gBtn + 'border:1.5px solid var(--accent2,#d4a843);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 14%, var(--bg-card));color:var(--accent2,#d4a843)">'
        + ((typeof rrAiOptedOut === 'function' && rrAiOptedOut())
            ? 'Read this photo (photo ID reads are off)'
            : 'Read this photo (1 photo ID)') + '</button>');
    var _numBox =
      _guessChip +
      '<input id="pin-rv-num" list="pin-rv-list" type="text" value="' + sug.replace(/"/g, '&quot;') + '" placeholder="Item number — e.g. 2343 or 6464-1" autocomplete="off" spellcheck="false" oninput="_pinReviewLookup(this.value)" style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);'
        // v0.9.1959: a step slimmer on the laptop card, so the reading fits; the phone keeps its size
        + (_wide2 ? 'padding:0.4rem 0.7rem;font-size:0.95rem;margin-bottom:0.4rem' : 'padding:0.6rem 0.75rem;font-size:1rem;margin-bottom:0.55rem') + '">' +
      '<datalist id="pin-rv-list">' + opts + '</datalist>' +
      _pinAltChips();
    var _btnArea = _wide2
      // ── the laptop card (v0.9.1958): ONE big orange Add; the other two adds
      // side by side; "Not sure what it is?" with its help as a small ? beside
      // the heading; Discard as a quiet link at the foot. One main button, a
      // few secondary ones, two small links — so the eye knows where to start.
      ? _numBox +
        '<div id="pin-rv-btns" class="pin-rv-btns">' +
         '<div class="pin-rv-grp">' +
          '<div style="' + _lbl + 'margin:0">What do you want to do with it?</div>' +
          _setBtn +
          _addBtn +
          // v0.9.1959: each button as wide as its words, so "Add to an existing
          // item in my collection" stays on one line where there is room
          '<div id="pin-rv-do" style="display:grid;grid-template-columns:max-content minmax(0,1fr);gap:0.35rem">' + _sellBtn + _attachBtn + '</div>' +
         '</div>' +
         '<div class="pin-rv-grp">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
            '<div style="' + _lbl + 'margin:0">Not sure what it is?</div>' +
            // v0.9.1181 (Brad): what each button does and the steps to follow —
            // the copy lives in help-photo-id.js. v0.9.1958: a small ? here.
            '<button id="pin-rv-help" onclick="_pinHelpOpen()" title="How best to use these features" aria-label="How best to use these features" style="width:22px;height:22px;flex:0 0 auto;border-radius:50%;border:1.5px solid var(--info);background:var(--surface2);color:var(--info);font-family:var(--font-body);font-weight:800;font-size:0.78rem;line-height:1;cursor:pointer;padding:0">?</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem">' + _rescanBtn + _researchBtn + _lensBtn + _tokBtn + '</div>' +
          (_pinAr() ? _tokLine() : '') +
         '</div>' +
          '<button id="pin-rv-discard" onclick="_pinReviewDiscard()" style="align-self:flex-start;justify-self:start;background:none;border:none;padding:0.1rem 0;margin-top:0;color:var(--t-red);font-family:var(--font-body);font-weight:700;font-size:0.76rem;text-decoration:underline;cursor:pointer">' + _discardTxt + '</button>' +
        '</div>'
      // ── the phone and the 1000px card: the arrangement they always had
      : _numBox +
        '<div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-top:0.35rem">' +
          '<div style="flex:1 1 240px;min-width:0">' +
            '<div style="' + _lbl + '">What do you want to do with it?</div>' +
            _setBtn + _addBtn + _sellBtn + _attachBtn +
            '<button onclick="_pinReviewDiscard()" style="' + _rvBtn('main') + 'border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--t-red)">' + _discardTxt + '</button>' +
          '</div>' +
          '<div style="flex:1 1 240px;min-width:0">' +
            '<div style="' + _lbl + '">Not sure what it is?</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' + _rescanBtn + _researchBtn + _lensBtn + _tokBtn + '</div>' +
            (_pinAr() ? _tokLine() : '') +
            '<button onclick="_pinHelpOpen()" style="width:100%;margin-top:0.15rem;padding:0.72rem;'
              + 'border-radius:10px;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;'
              + 'border:1.5px solid var(--info);background:var(--surface2);color:var(--info)">How best to use these features</button>' +
          '</div>' +
        '</div>';

    var _controlsHtml =
      (PIN._pinLensGroups ? _pinLensBannerHtml() : '') +   // v0.9.962: waiting-for-answer reminder after Research by Photo
      _pinAiLine() +
      '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;margin-bottom:0.7rem;display:flex;flex-direction:column;gap:0.4rem"></div>' +
      _btnArea;

    // ══ v0.9.1705 — ONE BIG "CURRENT PHOTO", ON EVERY DEVICE ═══════════════
    // Brad, phone, 2026-09-09: "when you open an items pictures, it says
    // 1 of 2, you can crop the first one, you can not hit the arrow to advance
    // to the next picture to crop it … I should be able to tap the pictures
    // in the small boxes that have the view labels to select the picture i
    // want to edit, and i would want the arrow to work then select it to
    // edit it."
    //
    // The card has always had a "current photo": #pin-rv-main. The arrows,
    // the "1 of 2" counter, the ✂, the read line and the number box all act on
    // it (_pinRvSetMain, _pinOnScreenFid). It existed in the DESKTOP layout
    // only. The phone card was a strip of thumbnails with no big picture, so
    // on a phone _pinRvSetMain found no element and returned — the arrow
    // pressed against nothing, silently, and the counter froze at "1 of 2".
    //
    // So the big picture is now built in ONE place and both layouts use it,
    // and so is the rail beneath it. Tap a rail thumb, or the picture in a
    // filled view-slot box, to make it the current photo; the ✂ and 🔍 on
    // the big picture act on whatever is showing. The per-thumb ✂/🔍 buttons
    // the phone strip used to carry are gone with it — they crowded a 74px
    // tile and they are what the big picture's own buttons are for.
    var _cornBtn = 'position:absolute;width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:0.9rem;line-height:1;cursor:pointer;padding:0;z-index:2';
    // The big picture, sized to the PHOTO and capped at maxH.
    // ══ v0.9.1829 (Brad, phone, 2026-09-28: "on the page where you crop, once
    // you crop it can we make the photo box match the crop so that we dont have
    // to scroll so much") ═══════════════════════════════════════════════════
    // v1705 pinned the phone box at a fixed 40vh so the card would not jump
    // between a portrait and a landscape photo. The cost showed up the moment
    // he cropped a boxcar down to a wide strip: a 40vh box with the strip
    // floating in the middle and the details pushed a screen down. So the box
    // now sizes to the photo on EVERY device — the photo's own shape, capped
    // at maxH — exactly as the desktop always did. One mode, one number per
    // layout; a crop reshapes the box the moment its bytes land. min-height
    // keeps the ✂ and 🔍 apart while the photo is still on its way.
    function _pinRvHeroHtml(maxH) {
      var box = 'position:relative;border-radius:12px;overflow:hidden;background:var(--surface2,#26262e);display:flex;align-items:center;justify-content:center;margin-bottom:0.5rem;min-height:64px;max-height:' + maxH + ';';
      var img = 'max-width:100%;max-height:' + maxH + ';object-fit:contain;display:block;cursor:zoom-in;';
      return '<div style="' + box + '">' +
        '<img id="pin-rv-main" data-rvbig="' + _mainFid + '" onclick="_pinZoomPhoto(this.getAttribute(\'data-rvbig\'))" title="Tap for full-screen zoom" style="' + img + '" alt="">' +
        '<button onclick="_pinZoomPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Full-screen zoom" style="' + _cornBtn + ';left:8px;bottom:8px">🔍</button>' +
        '<button onclick="_pinCropPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Crop / Rotate this photo" style="' + _cornBtn + ';top:8px;right:8px">✂</button>' +
      '</div>';
    }
    // The rail of photos still waiting to be sorted into a view slot
    // (v0.9.1617: a slotted photo lives in its slot). First one wears MAIN
    // VIEW; each carries its own read number; a tap makes it the current
    // photo. Only drawn when there is more than one — a lone thumb under a
    // big picture of the same photo says nothing.
    function _pinRvRailHtml(sizePx) {
      if (!_railThumbs.length) return '';
      var canDrag = !window.IS_MOBILE_UA;   // _pinWireRvDrag is desktop-only
      return '<div id="pin-rv-photos" style="display:flex;gap:0.4rem;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:0.6rem;padding:2px">' +
        _railThumbs.slice(0, 12).map(function (fidT, i) {
          var _tSug = _ids()[fidT];
          var _tNum = (_tSug && _tSug.num) ? String(_tSug.num) : '';
          return '<div data-dragfid="' + fidT + '" onclick="_pinRvSetMain(\'' + fidT + '\')" title="Show this photo' + (canDrag ? ' — drag to reorder' : '') + '" style="position:relative;flex-shrink:0;width:' + sizePx + 'px;height:' + sizePx + 'px;border-radius:8px;overflow:hidden;background:var(--surface2,#26262e);cursor:pointer;border:1.5px solid transparent">' +
            (i === 0 && !_rsvTaken ? '<div style="position:absolute;top:0;left:0;background:var(--accent);color:#fff;font-size:0.55rem;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:0 0 6px 0;z-index:2;pointer-events:none">MAIN VIEW</div>' : '') +
            // v0.9.1960 (Brad: "need a way to delete extra group pictures when you
            // move the photos to the orientation boxes ... and have 1 or 2 left
            // over"): each photo still waiting here can be discarded on its own.
            '<button data-rvdiscard="' + fidT + '" onclick="event.stopPropagation();_pinRvDiscardOne(\'' + fidT + '\')" draggable="false" title="Discard this photo (to your Google Drive trash)" aria-label="Discard this photo" style="position:absolute;top:2px;right:2px;z-index:3;width:20px;height:20px;border-radius:50%;border:none;background:rgba(0,0,0,0.7);color:#fff;font-size:0.72rem;font-weight:800;line-height:1;cursor:pointer;padding:0">\u2715</button>' +
            '<img data-rvfid="' + fidT + '" class="rr-fit" style="width:100%;height:100%;display:block" alt="">' +
            (_tNum ? '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);color:' + (_tSug.guess ? '#ffb454' : '#7ec3ef') + ';font-size:0.58rem;font-weight:700;text-align:center;padding:1px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + rrEsc(_tNum) + '</div>' : '') +
          '</div>';
        }).join('') +
      '</div>';
    }

    // Phone: big picture (the photo's own shape, up to 40% of the screen —
    // one number to tune), the rail, then the view-slot bar. Stacked, as
    // before, just with the element the arrows were always pointed at.
    var _stripHtml = _pinRvHeroHtml('40vh') + _pinRvRailHtml(74) + _pinRvViewsBarHtml();

    // v0.9.964 (Brad): DESKTOP layout — the "From the photo" read and the
    // catalog details sit as full-width boxes across the TOP, the photo fills
    // the middle full-width, and the action buttons run in a row across the
    // BOTTOM. (The old right-hand split panel — _panelHtml — was built on
    // every open and never used since v964; it is gone.)
    var _heroWide = _pinRvHeroHtml(_wide2 ? '40vh' : '52vh');
    var _photoWide = _heroWide + _pinRvRailHtml(64) + _pinRvViewsBarHtml();
    // v0.9.1943: on the laptop card the photo strip and the view-slot bar sit
    // SIDE BY SIDE under the photo (one row of height instead of two), so an
    // item with several photos still has every button on screen.
    var _photoWide2 = _heroWide +
      '<div id="pin-rv-strip" style="display:flex;gap:1rem;align-items:flex-start;min-width:0">' +
        '<div style="flex:0 1 auto;min-width:0">' + _pinRvRailHtml(64) + '</div>' +
        '<div style="flex:1 1 auto;min-width:0">' + _pinRvViewsBarHtml() + '</div>' +
      '</div>';
    var _aiL = (_pinAiLine(_mainFid) || '') + _pinTagLineHtml(_mainFid), _chips = _pinAltChips();
    var _wideBtn = 'flex:1 1 160px;padding:0.72rem 0.6rem;border-radius:10px;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;';
    var _wideBody =
      (PIN._pinLensGroups ? _pinLensBannerHtml() : '') +
      // Top: two full-width info boxes above the photo (or just details if no read yet).
      (_aiL
        ? '<div style="display:flex;gap:1rem;align-items:stretch;margin-bottom:0.8rem">' +
            '<div id="pin-rv-ailine" style="flex:1.25;min-width:0">' + _aiL + '</div>' +
            '<div style="flex:1;min-width:0"><div id="pin-rv-info" style="height:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;display:flex;flex-direction:column;gap:0.4rem"></div></div>' +
          '</div>'
        : '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;margin-bottom:0.8rem;display:flex;flex-direction:column;gap:0.4rem"></div>') +
      _photoWide +
      _btnArea;

    // v0.9.1739 — the two-column body. Same pieces as _wideBody, arranged so
    // nothing you need every time is ever below the fold. Both columns get
    // min-height:0 so the grid can shrink inside the capped card; the right
    // one scrolls, and the left one may too on a very short screen rather
    // than clipping a button.
    // v0.9.1943 (Brad: "you can [hardly] even see the photo"): the photo leaves
    // the left column and runs across the FULL width of the card on top — a
    // long side shot of a car shows about twice as tall, every other shape at
    // least as big as before. ACT (number + buttons) and READ sit under it.
    // v0.9.1958 (Brad: "This is way too big ... i can't see all the buttons as
    // i get lost" — "just do it"): photo and controls SIDE BY SIDE. The photo
    // takes the left of the card at its full height; on the right, the number,
    // the buttons, then what the photo said and the catalog details (those
    // scroll on their own, the buttons never move). v0.9.1959 (Brad: "be
    // freaking consistant"): every photo, whatever its shape — no wide-shot
    // exception. CSS grid areas in app.css (.pin-rv-grid) do the arranging.
    var _wideBody2 =
      (PIN._pinLensGroups ? _pinLensBannerHtml() : '') +
      '<div id="pin-rv-cols" class="pin-rv-grid" style="display:grid;min-height:0;flex:1">' +
        '<div id="pin-rv-top" class="pin-rv-photo" style="min-width:0;min-height:0;display:flex;flex-direction:column">' + _photoWide2 + '</div>' +
        '<div id="pin-rv-act" class="pin-rv-actcol" style="display:flex;flex-direction:column;min-width:0;min-height:0;overflow-y:auto">' +
          _btnArea +
        '</div>' +
        '<div id="pin-rv-read" class="pin-rv-readcol" style="min-width:0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:0.75rem">' +
          (_aiL ? '<div id="pin-rv-ailine">' + _aiL + '</div>' : '') +
          '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;display:flex;flex-direction:column;gap:0.4rem"></div>' +
        '</div>' +
      '</div>';

    var ov = document.createElement('div');
    ov.id = 'pin-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML =
      '<div class="rr-card' + (_wide2 ? ' rr-card-flex pin-rv-card' : '') + '"' + (_wide2 ? ' style="max-width:min(1500px,96vw)"' : (_wide ? ' style="max-width:820px"' : '')) + '>' +
        '<div id="pin-rv-nav" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">' +
          _pinRvNavHtml('prev') +
          '<div style="flex:1;min-width:0;font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _pinRvTitle(n) + '</div>' +
          _pinRvPosHtml() +
          _pinRvNavHtml('next') +
          '<button onclick="_pinCloseReview()" style="background:none;border:none;color:var(--text-dim);font-size:1.35rem;line-height:1;cursor:pointer;padding:0.1rem 0.3rem;margin-left:0.25rem">✕</button>' +
        '</div>' +
        (_wide2 ? _wideBody2 : (_wide ? _wideBody : _stripHtml + _controlsHtml)) +
      '</div>';
    document.body.appendChild(ov);
    // v0.9.1943: the laptop card's photo takes the room the buttons leave —
    // measured now and again every time the photo (re)loads (arrows, crop,
    // a rail tap all swap its src).
    try {
      var _fitImg = _wide2 && document.getElementById('pin-rv-main');
      if (_fitImg) { _fitImg.addEventListener('load', _pinRvFitHero); _pinRvFitHero(); }
    } catch (eFit) {}
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
    // v0.9.1616: the view-slot bar's minis load the same way.
    ov.querySelectorAll('img[data-rvv]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-rvv'), img, img.parentElement, null, 'hi');
    });
    try { _pinDemoteAdd(false); } catch (eD) {}
    var _rvMainImg = document.getElementById('pin-rv-main');
    if (_rvMainImg && window._pinRvLoadFull) window._pinRvLoadFull(_rvMainImg, _rvMainImg.getAttribute('data-rvbig'));
    try { _pinRvMarkCurrent(_mainFid); } catch (eMk) {}   // v0.9.1705: outline the current photo's thumb
    // Only look up what is actually in the box. A guess left as a chip must not
    // silently produce a Maker / Item # / Description panel — that panel is what
    // made "58" read as a finding rather than a hunch.
    _pinReviewLookup(sug);
  };

  function _pinAiLine(fid) {
    var rf = _pinRecFor(fid);
    var h = _pinAiLineFor(fid, rf.rec);
    // v0.9.1960: a borrowed read says where it came from
    if (h && rf.from) {
      h = h.replace(/<\/div>$/, '<div data-rvinherit="' + rf.from + '" style="font-size:0.72rem;color:var(--text-dim);margin-top:0.3rem">From another photo in this group</div></div>');
    }
    return h;
  }
  function _pinAiLineFor(fid, rec) {
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
      s = rec || (fid && ids0[fid])
        || ids0[_pinReadFid(PIN._rvGroups[0]) || PIN._rvGroups[0].files[0].id]
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
      // v0.9.1488 (Brad, closing what v1486 left open): the photo's own tag
      // is the ONLY yardstick for these warnings. An untagged photo gets NO
      // maker/scale mismatch warning — the collection page's browsing filter
      // has nothing whatsoever to do with the Photo Inbox.
      var _afEra = (s && s.dbg && s.dbg.era) || '';
      var _af = (_afEra && typeof rrActiveFilter === 'function') ? rrActiveFilter(_afEra) : null;
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
    // ── v0.9.1486 (Brad: 'can we get to where this says, "no lettering
    // picked up. Try Read this photo or Google Photo ID."'): a guess whose
    // number is a short unconfirmed token no longer wears the Best-guess
    // crown. The headline says what is TRUE; the token stays visible in the
    // why-lines below, so no possible guess is lost.
    var _weakTok = s.guess && s.num && String(s.num).replace(/\D/g, '').length <= 3;
    if (_weakTok) {
      return '<div style="margin-bottom:0.6rem;padding:0.6rem 0.75rem;border-left:3px solid var(--text-dim);background:var(--surface2);border-radius:0 8px 8px 0">'
        + '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:var(--text-dim);margin-bottom:0.25rem">No lettering picked up</div>'
        + '<div style="font-size:0.92rem;color:var(--text);line-height:1.4">Nothing readable enough to name this item — try ' + (_pinAr() ? '<b>Read this photo (1 photo ID)</b> or ' : '') + '<b>Google Photo ID</b>.</div>'
        + _mismatch
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

  // v0.9.901 (Brad): pick-one chips when the reader listed look-alike
  // variants — the ★ chip is its best guess; tapping any chip fills the
  // number box and runs the catalog lookup.
  //
  // ══ v0.9.1833 — EACH CHOICE SAYS WHAT IT IS AND LINKS TO ITS PAGE ═══════
  // [stated] Brad, phone, 2026-09-28, after picking 6464-25 from the two the
  // reader had narrowed his Great Northern to: "if you don't know, from this
  // screen you still don't know what to pick. need to include the link for
  // each underneath the number so you can pick." Once a dashed number is in
  // the box the family panel is gone (a dashed number is taken as decided),
  // so these chips were the only way to switch — and a bare number tells
  // you nothing. Now each choice carries its catalogue description and a
  // "view ↗" to its reference page — the SAME row and link the family panel
  // shows (_pinCardRowFor), so the two can be looked at before picking.
  // _pinAltList is the one list; the chips and the "use this" guess chip
  // both read it. The record is _rvAiRec — the ONE the card resolved (v1096).
  function _pinAltList() {
    var s = {};
    try { s = PIN._rvAiRec || {}; } catch (eR) { s = {}; }
    var alts = Array.isArray(s.alts) ? s.alts.slice(0) : [];
    if (!alts.length) return [];
    var primary = String(s.num || '');
    var covered = alts.some(function (a) { return primary && String(a).indexOf(primary) > -1; });
    if (primary && !covered) alts.unshift(primary + ' (best guess)');
    var out = [], seen = {};
    alts.forEach(function (a) {
      var m = String(a).match(/[0-9][0-9A-Za-z.\-\/]*/);
      var n = m ? m[0] : '';
      if (n) { if (seen[n]) return; seen[n] = 1; }   // the same number twice is one choice
      var row = n ? _pinCardRowFor(n) : null;
      out.push({ label: String(a), n: n, hot: !!(n && primary && n === primary),
                 desc: row ? String(row.description || row.roadName || '') : '',
                 link: row ? String(row.refLink || '') : '',
                 row: row || null });   // v0.9.1873: the row itself, so its status tag can be drawn
    });
    return out;
  }
  function _pinAltChips() {
    var list = _pinAltList();
    if (!list.length) return '';
    var esc = (typeof rrEsc === 'function') ? rrEsc : function (t) { return String(t).replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    var anyHot = list.some(function (c) { return c.hot; });
    var chips = list.map(function (c) {
      var num = '<button type="button" onclick="_pinPickNum(\'' + esc(c.n) + '\')" style="padding:0.35rem 0.6rem;border-radius:8px;border:1.5px solid ' + (c.hot ? '#ffb454' : 'var(--border)') + ';background:' + (c.hot ? 'rgba(255,180,84,0.14)' : 'var(--surface2)') + ';color:' + (c.hot ? '#ffb454' : 'var(--text-mid)') + ';font-size:0.75rem;font-weight:700;cursor:pointer;font-family:var(--font-body)">' + (c.hot ? '★ ' : '') + esc(c.label) + '</button>';
      // the description and the page, underneath the number (Brad's red marks)
      var desc = c.desc ? '<div class="pin-alt-desc" style="font-size:0.7rem;color:var(--text-dim);line-height:1.3;max-width:12em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.desc) + '</div>' : '';
      // the app's action blue is the palette's --want (typed as #2980b9
      // elsewhere in this file) — no new colour literal
      var link = c.link ? '<button type="button" class="pin-alt-view" onclick="window.open(\'' + esc(c.link) + '\',\'_blank\',\'noopener\')" style="border:none;background:none;padding:0.2rem 0;min-height:30px;color:var(--want);font-family:var(--font-body);font-size:0.74rem;font-weight:700;cursor:pointer;text-align:left">view ↗</button>' : '';
      var stat = (c.row && typeof rrCatalogStatusChip === 'function') ? rrCatalogStatusChip(c.row, { block: true }) : '';   // v0.9.1873
      return '<div class="pin-alt" style="display:flex;flex-direction:column;align-items:flex-start;gap:0.1rem;max-width:12em">' + num + desc + stat + link + '</div>';
    }).join('');
    return '<div style="margin-bottom:0.6rem">' +
      '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.3rem">Could be one of these — view each to compare, then tap the one you have' + (anyHot ? ' (★ = best guess)' : '') + ':</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.4rem 0.9rem;align-items:flex-start">' + chips + '</div></div>';
  }
  if (typeof window !== 'undefined') { window._pinAltList = _pinAltList; window._pinAltChips = _pinAltChips; }

  // ══ v0.9.1444 (Brad's 6436) — SHOW THE DASHED FAMILY ══════════════════════
  // "there is no way for our reader to know this is a -110. thats why we need
  //  to show the options."  He is right: 6436 is what is printed on the car;
  //  the -110 is Lionel's sub-number for the red one and it appears on the BOX.
  //
  // v0.9.1372 built the family finder (rrDashedKin) and the inbox already used
  // it — but only on the branch where the number is NOT in the catalogue. For
  // 6436 the lookup SUCCEEDED, on a row from the Boxes tab, so that branch was
  // never reached and five real item rows went unmentioned. A demoted row still
  // wins when it is the only row there is, which is correct, and is exactly the
  // case nobody had allowed for.
  //
  // Lead with the base, list the relatives underneath with their references, so
  // the choice is made by looking rather than by guessing.
  function _pinKinRowsFor(n) {
    try {
      if (typeof window._mbAllGet === 'function') return window._mbAllGet(String(n).trim()) || [];
      if (window.state && state.masterByItem && state.masterByItem.get) return state.masterByItem.get(String(n).trim()) || [];
    } catch (e) {}
    return [];
  }
  // ══ v0.9.1833 — ONE answer to "which catalogue row stands for this number
  // on the card?" ═══════════════════════════════════════════════════════════
  // The first real item row in the card's eras (a box, set or paper row only
  // when nothing better carries the number — _pinDemotedRow / rrDemotedRow
  // decides what "real" is). The family panel's lines and the pick chips
  // both ask here, so a chip and a panel line can never describe, or link
  // to, two different rows for the same number.
  function _pinCardRowFor(n) {
    try {
      var eras = [];
      try { eras = _prefEras(_rvPrefer()) || []; } catch (eE) { eras = []; }
      var inEra = function (r) { return !!r && (!eras.length || eras.indexOf(r._era) >= 0); };
      var isItem = function (r) {
        if (typeof window.rrDemotedRow === 'function') return !window.rrDemotedRow(r);
        return !/boxes/i.test(String(r._tab || ''));
      };
      var all = _pinKinRowsFor(n).filter(inEra);
      return all.filter(isItem)[0] || all[0] || null;
    } catch (e) { return null; }
  }
  if (typeof window !== 'undefined') window._pinCardRowFor = _pinCardRowFor;
  // ── v0.9.1448 (Brad's 6464-25 Great Northern, read as prewar "500"):
  // the car says 6464 — the HEAD of a dashed family. No row carries bare
  // 6464, so it matched nothing in the stamped era, and an off-era literal
  // 500 won. A number that heads a dashed family in the stamped era is what
  // the car actually says. The words read beside it — road name off the
  // car, road name and COLORS from the paid reader's description — are
  // compared against each family member's description and road name (the
  // reference-book facts already in the master list, COTT links beside
  // them). One clear winner → that variant is offered, with the words
  // that decided it. A tie or nothing distinctive → the base leads and
  // the family panel lets the human pick. Never stated as FACT: the -XX is
  // printed on the box, not on the car.
  var _FAM_STOPWORDS = { LIONEL:1, LINES:1, TRAIN:1, TRAINS:1, RAILROAD:1, RAILWAY:1,
    BOXCAR:1, GONDOLA:1, CABOOSE:1, HOPPER:1, REEFER:1, FLATCAR:1,
    CAPY:1, BUILT:1, WITH:1, THIS:1, THAT:1, FROM:1, HAVE:1, ITEM:1, SCALE:1, GAUGE:1 };
  // ══ v0.9.1734 — WHICH OF THESE IS THE CAR IN THE PHOTO? ══════════════════
  // Brad's 6050: the catalog has NINE item rows under that number — variations
  // 1-5 Libby's Tomato Juice, 6-8 Lionel Savings Bank, 9 Swift. All Lionel, all
  // Postwar, all Boxcar, so every rank in _pinBestMaster ties and load order
  // hands back variation 1. His car is the Savings Bank one, and it says so on
  // its side: the read text carries SAVINGS and BANK.
  //
  // This is the v0.9.1721 lesson again — "the road name decides" — moved from
  // the COTT link resolver to the row picker. The words that identify a car
  // are its road name and product name, so those are the only haystack.
  //
  // varDesc is deliberately NOT searched. It is shell-and-lettering prose
  // ("TYPE 3, WHITE SHELL UNPAINTED, WITH RED & BLUE HEAT STAMPED"), and a
  // photo of a white boxcar says WHITE too — that would pick a variation for a
  // reason that has nothing to do with which car it is.
  //
  // One clear winner or nothing: best must beat second outright, exactly as
  // _pinFamilyPick requires, because a tie is not evidence.
  function _pinRowFromWords(rows, srcText) {
    try {
      if (!rows || rows.length < 2 || !srcText) return null;
      var words = [];
      String(srcText).toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/).forEach(function (w) {
        if (w.length >= 4 && !_FAM_STOPWORDS[w] && words.indexOf(w) < 0) words.push(w);
      });
      if (!words.length) return null;
      // Score IDENTITIES, not rows. Brad's 6050 has THREE Savings Bank rows
      // (variations 6, 7, 8) — scoring row by row, all three tie on the same
      // two words, "best beats second" can never hold, and the winner is
      // thrown away as ambiguous. The one case this exists for would have
      // silently never fired. A tie between two spellings of the SAME car is
      // not ambiguity; a tie between Libby's and Swift is.
      var groups = [], byId = {};
      rows.forEach(function (r) {
        if (!r) return;
        // ══ v0.9.1735 — THE EMPTY BOX MAY NOT OUT-VOTE THE CAR ═════════════
        // Measured on Brad's live 6050 card, which still said Libby's after
        // v1734. His photo reads "XMAS ... LIONEL SAVINGS BANK SAVINGS TELLER
        // CLUB", and the scores under 6050 came out:
        //     Libby's Tomato Juice ............ 0
        //     Lionel Savings Bank Boxcar ...... 5   <- the car
        //     Swift Boxcar .................... 0
        //     "Lionel Savings Bank Boxcar, 6" . 5   <- its BOX, in PW - Boxes
        // A box is lettered with the name of the car inside it, so it scores
        // identically every time. Two identities tied at 5, the helper
        // correctly refused to choose on a tie, and the fallback was load
        // order — Libby's. The guard against guessing became the thing that
        // guaranteed the wrong answer.
        //
        // Same principle as v0.9.1733: a box is not a candidate identity for a
        // photo of a car. _pinDemotedRow is the one place that knows which
        // rows those are (box, set, paper, catalog, display, instruction), and
        // it is already shared with browse.js and the relatives panel.
        try { if (_pinDemotedRow(r)) return; } catch (eD) {}
        var road = String(r.roadName || ''), desc = String(r.description || '');
        var idk = (road + '|' + desc).toUpperCase();
        if (!byId[idk]) { byId[idk] = { row: r, hay: (road + ' ' + desc).toUpperCase() }; groups.push(byId[idk]); }
      });
      if (groups.length < 2) return null;      // one identity — nothing to choose
      var best = null, bestN = 0, secondN = 0, bestWhy = [];
      groups.forEach(function (g) {
        var n = 0, why = [];
        words.forEach(function (w) { if (g.hay.indexOf(w) >= 0) { n++; why.push(w); } });
        if (n > bestN) { secondN = bestN; bestN = n; best = g; bestWhy = why; }
        else if (n > secondN) secondN = n;
      });
      if (best && bestN >= 1 && bestN > secondN) {
        return { row: best.row, why: bestWhy.slice(0, 3).join(', ') };
      }
      return null;
    } catch (e) { return null; }
  }
  if (typeof window !== 'undefined') window._pinRowFromWords = _pinRowFromWords;

  function _pinFamilyPick(c, prefer, srcText) {
    try {
      c = String(c || '').trim();
      if (!c || /[-–]/.test(c)) return null;
      if (c.replace(/\D/g, '').length < 4) return null;   // 3-digit bases are coincidence bait
      if (typeof rrDashedKin !== 'function') return null;
      var kin = rrDashedKin(c) || [];
      if (!kin.length) return null;
      var eras = _prefEras(prefer);
      var fams = [];
      kin.forEach(function (k) {
        var rows = _pinKinRowsFor(k).filter(function (r) {
          if (!r) return false;
          if (eras.length && eras.indexOf(r._era) < 0) return false;
          if (typeof window.rrDemotedRow === 'function' && window.rrDemotedRow(r)) return false;
          return true;
        });
        if (rows.length) fams.push({ num: String(k),
          txt: rows.map(function (r) { return (r.description || '') + ' ' + (r.roadName || ''); }).join(' ').toUpperCase() });
      });
      if (!fams.length) return null;
      var words = [];
      String(srcText || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/).forEach(function (w) {
        if (w.length >= 4 && !_FAM_STOPWORDS[w] && words.indexOf(w) < 0) words.push(w);
      });
      var best = null, bestN = 0, secondN = 0, bestWhy = [];
      fams.forEach(function (e) {
        var n = 0, why = [];
        words.forEach(function (w) { if (e.txt.indexOf(w) >= 0) { n++; why.push(w); } });
        e.score = n; e.why = why;
        if (n > bestN) { secondN = bestN; bestN = n; best = e; bestWhy = why; }
        else if (n > secondN) secondN = n;
      });
      if (best && bestN >= 1 && bestN > secondN) {
        return { num: best.num, fam: c, count: fams.length, why: bestWhy.slice(0, 4).join(', ') };
      }
      // ══ v0.9.1772 — A TIE IS NOT "NO IDEA" ═══════════════════════════════
      // Brad's Great Northern 6464. The words GREAT and NORTHERN score the same
      // on 6464-25 and 6464-450, both catalogued "Great Northern | Great
      // Northern Boxcar", so the rule above correctly refuses to choose — and
      // then threw away the fact that it had narrowed 35 relatives down to two.
      // Refusing to pick one is right. Handing back the whole family as though
      // nothing had been learned is not. (What separates those two is colour —
      // -25 is orange with white lettering, -450 olive and orange with yellow —
      // and colour is in varDesc, which this picker deliberately does not read.
      // So two is the honest floor here, not a shortfall.)
      if (bestN >= 1) {
        var tied = fams.filter(function (e) { return e.score === bestN; })
                       .map(function (e) { return String(e.num); });
        if (tied.length > 1 && tied.length < fams.length) {
          return { num: c, fam: c, count: fams.length, why: '',
                   tied: tied, tiedWhy: bestWhy.slice(0, 4).join(', ') };
        }
      }
      return { num: c, fam: c, count: fams.length, why: '' };
    } catch (e) { return null; }
  }
  // readAlts (v0.9.1832): the photo's read alternatives \u2014 for a family read
  // (v1772 / v1831) those are the relatives the words narrowed it to, and
  // they are listed first, marked. Anything in it that is not a member of
  // THIS family is ignored, so a number typed over the read changes nothing.
  function _pinKinPanelHtml(num, matched, readAlts) {
    try {
      var n = String(num || '').trim();
      if (!n || typeof rrDashedKin !== 'function') return '';
      // Someone who typed 6436-110 has already been specific; rrDashedKin
      // returns the PARENT for a dashed number and we do not second-guess it.
      if (/[-\u2013]/.test(n)) return '';
      var kin = rrDashedKin(n) || [];
      if (!kin.length) return '';
      // ── v0.9.1448 (Brad's 2383 offered Lehigh Valley HO cousins): the
      // relatives list searched every tab, so a postwar-stamped photo was
      // offered another scale's family. When the card's filter names eras,
      // only relatives from those eras belong in the list.
      var _kinEras = [];
      try { _kinEras = _prefEras(_rvPrefer()) || []; } catch (eKE) {}
      var _eraOk = function (r) { return !_kinEras.length || (r && _kinEras.indexOf(r._era) >= 0); };
      var esc = (typeof rrEsc === 'function') ? rrEsc : function (s) { return String(s); };
      // v0.9.1444: "is this a real item row?" is already answered once, in
      // _pinDemotedRow / window.rrDemotedRow — which demotes box, set, paper,
      // catalog, display and instruction rows alike. Re-stating it here as a
      // private /boxes/ test would be a second answer to the same question,
      // and the one that goes stale. Falls back to the box test only if the
      // shared helper is somehow absent.
      var _isItemRow = function (r) {
        if (!r) return false;
        if (typeof window.rrDemotedRow === 'function') return !window.rrDemotedRow(r);
        return !/boxes/i.test(String(r._tab || ''));
      };
      var matchedIsSecondary = !!(matched && !_isItemRow(matched));
      var line = function (label, desc, link, isBase, road, fits) {
        var safe = String(label).replace(/'/g, '');
        // v0.9.1735: a base line names WHICH row it is, so clicking it picks
        // that car rather than retyping a number the box already holds.
        var _q = function (x) { return String(x == null ? '' : x).replace(/\\/g, '').replace(/'/g, '').replace(/"/g, ''); };
        var _go = (isBase && (road || desc))
          ? '_pinPickRow(\'' + safe + '\',\'' + _q(road) + '\',\'' + _q(desc) + '\')'
          : '_pinPickNum(\'' + safe + '\')';
        // v0.9.1832: a relative the read narrowed the family to is green and
        // wears a "fits" tag; the hint line above the list says what fits.
        // The green is the palette's own (--green in app.css), never a literal
        // here; the tint is mixed from it, with the plain surface as the
        // fallback for a browser without color-mix.
        var _edge = fits ? 'var(--green)' : (isBase ? '#2980b9' : 'var(--border)');
        var _fill = fits ? 'var(--surface2);background:color-mix(in srgb, var(--green) 10%, var(--surface2))' : (isBase ? 'rgba(41,128,185,0.14)' : 'var(--surface2)');
        var _ink = fits ? 'var(--green)' : (isBase ? '#2980b9' : 'var(--accent2,#c9922a)');
        return '<button type="button" onclick="' + _go + '" style="display:flex;align-items:center;gap:0.5rem;width:100%;box-sizing:border-box;text-align:left;'
          + 'background:' + _fill + ';border:1px solid ' + _edge + ';'
          + 'border-radius:8px;padding:0.4rem 0.55rem;margin-top:0.3rem;cursor:pointer;color:var(--text);font-family:var(--font-body)">'
          + '<span style="font-family:var(--font-mono);font-weight:700;font-size:0.82rem;color:' + _ink + ';flex-shrink:0">' + esc(label) + '</span>'
          + '<span style="font-size:0.74rem;color:var(--text-dim);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(desc || '') + '</span>'
          + (fits ? '<span class="pin-kin-fits" style="flex-shrink:0;font-size:0.66rem;font-weight:700;color:var(--green);border:1px solid var(--green);border-radius:999px;padding:0.05rem 0.45rem;white-space:nowrap">✓ fits</span>' : '')
          // Session 85: an <a> may not nest inside a <button> (invalid HTML;
          // screen readers announce one control containing another). Same
          // look, same behaviour, as a span that opens the link itself.
          + (link ? '<span onclick="event.stopPropagation();window.open(\'' + esc(link) + '\',\'_blank\',\'noopener\')" style="flex-shrink:0;font-size:0.7rem;font-weight:700;color:var(--t-link);cursor:pointer">view \u2197</span>' : '')
          + '</button>';
      };
      var _numeric = function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); };
      // One relative, one line — the first real item row in the card's eras
      // (a box or paper row only when nothing better carries the number).
      var _kinLine = function (k, fits) {
        var r0 = _pinCardRowFor(k);   // v0.9.1833: the same row the pick chips describe
        if (!r0) return false;
        html += line(k, r0.description || '', r0.refLink || '', false, '', fits);
        if (typeof rrCatalogStatusChip === 'function') html += rrCatalogStatusChip(r0, { block: true });   // v0.9.1873
        return true;
      };
      // The base first — but only when a real item row carries it.
      var baseRows = _pinKinRowsFor(n).filter(_isItemRow).filter(_eraOk);
      var html = '';
      // ══ v0.9.1832 — THE RELATIVES THE READ NARROWED TO COME FIRST, MARKED ══
      // Brad's Great Northern 6464, the last S9 phone check (2026-09-28). v1831
      // read it right — "narrowed to 6464-25 or 6464-450 on: GREAT, NORTHERN"
      // — and the panel under that very sentence listed 6464-1, -25, -50, -75,
      // -100 … in catalogue order, as though nothing had been learned: a
      // scroll through the whole family to find the two the reader had
      // already singled out. The read's alternatives ARE those relatives (the
      // tied members, v1772); the ones that belong to THIS family lead the
      // list, marked, and the rest follow in catalogue order exactly as before.
      var _fit = [];
      try {
        (Array.isArray(readAlts) ? readAlts : []).forEach(function (a) {
          var s = String(a == null ? '' : a).trim();
          if (kin.indexOf(s) < 0) { var mA = s.match(/^[0-9][0-9A-Za-z.\-\/–]*/); s = mA ? mA[0] : ''; }
          if (s && kin.indexOf(s) >= 0 && _fit.indexOf(s) < 0) _fit.push(s);
        });
      } catch (eFit) { _fit = []; }
      var _shownKin = {}, _fitN = 0;
      _fit.sort(_numeric).forEach(function (k) { if (_kinLine(k, true)) { _shownKin[k] = 1; _fitN++; } });
      // ══ v0.9.1734 — EVERY IDENTITY UNDER THIS NUMBER, not just the first ══
      // Brad's 6050 listed "Libby's Tomato Juice Boxcar" and the 6050-110
      // Swift, and stopped. His car is the Lionel Savings Bank boxcar, which is
      // variations 6-8 of that same 6050 — so the one panel whose whole job is
      // "pick the one you have" was the one place his car could not be picked.
      // It only ever rendered baseRows[0].
      //
      // Distinct IDENTITY means a distinct road name + description; the five
      // Libby's variations are one identity, not five lines. Variations differ
      // by shell colour and lettering, and that belongs in the Add flow's
      // variation step, not here.
      if (baseRows.length) {
        var _seenId = {}, _shown = 0;
        baseRows.forEach(function (r) {
          if (_shown >= 6) return;
          var idk = (String(r.roadName || '') + '|' + String(r.description || '')).toUpperCase();
          if (_seenId[idk]) return;
          _seenId[idk] = 1; _shown++;
          html += line(n, r.description || r.roadName || '', r.refLink || '', true, r.roadName || '');
        });
      }
      // then the rest of the relatives, in catalogue order
      kin.slice().sort(_numeric).forEach(function (k) { if (!_shownKin[k]) _kinLine(k, false); });
      if (!html) return '';
      var head = baseRows.length
        ? 'This number also comes as these \u2014 pick the one you have'
        : (matchedIsSecondary
            ? 'No plain ' + esc(n) + ' item exists \u2014 that match was a box or paper entry. The catalogue has these'
            : 'The catalogue lists ' + esc(n) + ' as these');
      // v0.9.1832: say what the green "fits" lines are, in the words the
      // disclosure uses ("what was read") \u2014 never stated as fact.
      var _fitWord = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' }[_fitN] || String(_fitN);
      var _fitNote = _fitN
        ? '<span class="pin-kin-fits-note" style="color:var(--green);font-weight:700">The first ' + (_fitN === 1 ? 'one fits' : _fitWord + ' fit') + ' what was read from the photo.</span> '
        : '';
      return '<div style="margin-top:0.5rem;padding:0.5rem 0.6rem;border:1px solid rgba(41,128,185,0.45);border-radius:10px;background:rgba(41,128,185,0.06)">'
        + '<div style="font-size:0.76rem;font-weight:700;color:var(--t-link);margin-bottom:0.1rem">' + head + '</div>'
        + '<div style="font-size:0.68rem;color:var(--text-dim);margin-bottom:0.15rem">' + _fitNote + 'The sub-number is on the box, not the car \u2014 open a reference to compare.</div>'
        + html + '</div>';
    } catch (e) { return ''; }
  }
  if (typeof window !== 'undefined') window._pinKinPanelHtml = _pinKinPanelHtml;

  // ══ v0.9.1735 — "PICK THE ONE YOU HAVE" NOW ACTUALLY PICKS ═══════════════
  // Brad, looking at the 6050 panel listing Libby's / Lionel Savings Bank /
  // Swift: "it says pick the one you have and you cant pick it to add it."
  // Correct — every line called _pinPickNum('6050'), and all three lines carry
  // the SAME number, so clicking any of them typed 6050 into the box that
  // already said 6050 and nothing moved. The panel listed the answers and
  // offered no way to choose one.
  //
  // The card already has all three destinations he wants — Add to collection,
  // Send to For Sale, and "Add to an existing item in my collection" — and
  // every one of them acts on whatever the card currently believes the item
  // is. So nothing new is needed: picking an identity has to change that
  // belief, and the existing buttons follow it.
  //
  // _rvPickedId is that belief. It is cleared whenever a different photo is
  // opened, so it can never leak from one review to the next.
  PIN._rvPickedId = null;
  function _rvClearPick() { PIN._rvPickedId = null; }
  window._pinPickNum = function (n) {
    _rvClearPick();
    var i = document.getElementById('pin-rv-num');
    if (i) i.value = n || '';
    window._pinReviewLookup(n || '');
  };
  // Same, but naming WHICH of the rows under that number the user means. The
  // road name is the identity (the five Libby's variations are one identity,
  // not five); the variation step in the Add flow is where a specific shell
  // colour gets chosen, and it is no longer scoped away from him by v0.9.1734.
  window._pinPickRow = function (n, road, desc) {
    PIN._rvPickedId = { num: String(n || ''), road: String(road || ''), desc: String(desc || '') };
    var i = document.getElementById('pin-rv-num');
    if (i) i.value = n || '';
    window._pinReviewLookup(n || '');
    try { showToast('Using ' + (road || desc || n) + ' — now choose Add, For Sale, or an item you already own', 4500); } catch (e) {}
  };
})();
