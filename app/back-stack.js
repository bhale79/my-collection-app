// ═══════════════════════════════════════════════════════════════════
// back-stack.js — Central back-button / modal-close stack manager.
//
// Any overlay/modal that wants the device-back button (Android hardware
// back, mouse "Back", browser gesture, keyboard Alt+Left) to CLOSE the
// modal instead of navigating away from the app should do:
//
//     // when opening:
//     BackStack.push('my-modal-id', closeFn);
//
//     // when closing voluntarily (user taps X, ESC, Finish, etc.):
//     BackStack.pop('my-modal-id');
//
// On a hardware back press:
//   - If any entry is on the stack → runs the top entry's closeFn and
//     removes it. The app does NOT navigate away. stopImmediatePropagation
//     prevents app.js's own popstate handler from also firing.
//   - If the stack is empty → the event falls through to whatever listener
//     app.js registered later (the dashboard-nav + double-tap-exit logic).
//
// Initializes itself at script load, so it covers pre-auth screens too
// (sign-in, Gmail help modal) — before app.js's _initBackButton runs.
//
// All configurable behavior (debug log flag, history-state key) is kept
// here in one place per the centralized-config rule.
// ═══════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  var CFG = {
    stateKey: '_back',   // history.state.{stateKey} = modal id we pushed
    debug:    false,     // set true to log every push/pop for troubleshooting
    exitMs:   2200,      // 2026-11-11: how long "press back again to exit" holds the floor
  };

  var _stack = [];               // array of { id: string, closeFn: function }
  // v0.9.1936: a COUNT, not a flag. Each history.back() we make ourselves (in
  // pop) fires one popstate a moment later. When two overlays closed in the
  // same instant — the "Add a picture" chooser stepping aside for the Google
  // Photos waiting panel, and the panel coming straight down again — both
  // calls set the same true, the first popstate cleared it, and the SECOND
  // was taken for the user pressing Back: it closed whatever sat below
  // (pic_first_tests G2 caught it — the picture box vanished).
  var _ignorePops = 0;             // self-made history traversals still to come (one per _flushBacks)
  var _inited = false;
  // ══ 2026-11-07 (audit finding 17, Safari engine — iPhone, iPad, Mac) ══════
  // Two overlays closing in the same instant used to make TWO history.back()
  // calls. The Chrome engine answers each with its own popstate; the Safari
  // engine MERGES the two traversals and answers ONCE ("back back push pop"
  // in the audit's trace, against "back back push pop pop" on Android). The
  // count above then stayed one too high, and the person's NEXT real Back
  // (swipe-back, Back button) was taken for a self-made one and swallowed:
  // the Add window stayed open. Now every history step this file asks for in
  // one script run is gathered into ONE history.go(-n), asked for the moment
  // that run ends (a microtask — the same beat the old history.back() was
  // queued at, so nothing else can slip in between) — one traversal, one
  // popstate on every engine — and the count goes up by exactly one. A push
  // while a step is still owed REPLACES the top history entry instead of
  // adding one (the step owed and the new entry cancel out), so "close one,
  // open another" — and the review's pop, push, pop in one run — never ask
  // for two traversals.
  // ══ 2026-11-08 (finding 17, second half — the live re-run still failed A7) ══
  // Gathering one script run's steps was not enough: the Safari engine also
  // drops a traversal asked for while an EARLIER one is still on its way
  // (history.go is answered a moment later; a second go before that answer
  // is merged into the first — one popstate for two asks). The Add window
  // closes in beats, not at once: its own entry and the entries of the
  // wired sub-overlays inside it (their element watchers pop a microtask
  // later), so its steps were asked for a beat apart and Safari answered
  // once. So now ONE traversal is in flight at a time: steps asked for while
  // one is on its way wait, and go out together the moment its popstate
  // lands. A push while one is on its way (and no step owed) waits the same
  // moment — asked at once, its new entry would be stranded in the forward
  // list when the traversal lands and the floor would sit one entry too low.
  // A traversal that is never answered (nowhere to go) is given up after a
  // moment and its ignore is taken back, so a real Back is never swallowed
  // for it; the give-up itself waits one more turn first, so an answer that
  // is already queued behind it gets its turn.
  var _backsPending = 0, _backFlushQueued = false;
  var _goInFlight = false, _goTimer = null, _pushesDeferred = 0;
  // ══ 2026-11-11 (backtruth — hand-tests T-2026-11-08-03 and -06 FAILED) ════
  // Chrome's rule ("history manipulation intervention"): a history step ADDED
  // without a touch on the page marks every step of the app as skippable until
  // the next touch — and a Back press is not a touch. The app used to add a
  // step while ANSWERING a Back press (to hold its place), so Back, Back with
  // no tap between closed the app on Android (seen on Brad's phone,
  // 2026-11-11: item page → Back → Back = app closed; one touch between = fine).
  // So this file is now the ONE owner of every history step the app makes, and
  // its rule is: NEVER add a step while answering a Back press.
  //   • a page opening (showPage → nav) adds its step only on a touch;
  //   • a step says what it shows: { rr, s, appPage, item, d } — the page, the
  //     item's number in app.js's table (memory only), and how many steps it
  //     sits above the floor;
  //   • to hold its place after a Back, the app walks FORWARD again onto the
  //     step it just left (stay) — a walk adds nothing;
  //   • a pop-up re-opened by its own Back handler (the Add window stepping
  //     back) takes back the step that Back just left (re-arm) the same way;
  //   • a pop-up that opens with no touch since a Back gets no step of its
  //     own (own: 0) — closing it rewinds nothing.
  var _noTouch = false;            // a Back / Forward press, and no touch on the page since
  var _dispatching = false, _rearmed = false, _dispatchOwn = 1;
  var _fwdPending = 0, _landFns = [], _navDeferred = null;
  var _ctx = null;                 // app.js: what is on screen now → { appPage, item }
  var _load = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);   // this page load (an item's number means nothing in another load)
  function _ctxNow() { try { return (_ctx && _ctx()) || {}; } catch (e) { return {}; } }
  function _ours(st) { return !!(st && st.rr === 1); }
  function _depthNow() { try { var st = history.state; return (_ours(st) && typeof st.d === 'number') ? st.d : 0; } catch (e) { return 0; } }
  function _pageState(c, d) { return { rr: 1, s: _load, appPage: (c && c.appPage) || '', item: (c && c.item) || 0, d: d }; }
  var _floorHold = false;          // sitting on the floor after "press back again to exit"
  var _exitTimer = null;
  var _pageOwed = null;            // a page's step to re-label once the pop-up over it has closed (nav)
  // ── Is there a step to walk FORWARD onto? (review 2026-11-11, F3) ──────────
  // A walk forward with nowhere to go is never answered, and for a moment a
  // real Back press would be taken for the app's own walk. So a walk forward
  // is only ever asked for when a step is known to be there: the browser says
  // so where it can (the Navigation API); elsewhere the app keeps count from
  // the depth each step carries (a walk DOWN leaves a step above; a step
  // added, or a walk up, leaves none known).
  var _fwdOk = false, _lastD = 0;
  function _fwdRoom() {
    try {
      var nv = window.navigation;
      if (nv && nv.currentEntry && typeof nv.entries === 'function') return Math.max(0, nv.entries().length - 1 - nv.currentEntry.index);
    } catch (e) {}
    return _fwdOk ? 1 : 0;
  }
  function _landed() {             // any walk landed (the person's or the app's own)
    var d = _depthNow();
    _fwdOk = d < _lastD;
    _lastD = d;
  }
  // THE one place a history step is ADDED (four callers, all in this file).
  function _add(st) {
    history.pushState(st, '', '');
    _fwdOk = false; _lastD = (st && typeof st.d === 'number') ? st.d : 0;
    _floorOff();                   // a step above the floor: the exit hold is over
  }
  function _floorOff() {
    _floorHold = false;
    if (_exitTimer) { clearTimeout(_exitTimer); _exitTimer = null; }
  }
  function _isBase(st) { return _ours(st) && st.appPage === 'base'; }
  // A label is never written onto the floor itself (review F3).
  function _relabel(c) {
    try {
      var cur = history.state;
      if (!_ours(cur) || _isBase(cur)) return;
      history.replaceState(_pageState(c, _depthNow() || 1), '', '');
    } catch (e) {}
  }
  // The person TAPPED the page (a finished tap or a key, never the start of a
  // swipe or a scroll — review F1: a swipe-Back begins with a touch, and
  // counting that kept the app from ever being left). They are staying: a
  // fresh Dashboard step goes above the floor — a tap is what lets a step be
  // added — so the NEXT Back asks "press back again" once more.
  function _offFloorByTap() {
    _floorOff();
    var up = function () {
      try {
        var cur = history.state;
        if (_ours(cur) && !_isBase(cur)) return;       // not on the floor after all
        _add(_pageState(_ctxNow(), _depthNow() + 1));
      } catch (e) { console.warn('[BackStack] off the floor:', e); }
    };
    if (_goInFlight || _backsPending > 0 || _backFlushQueued) { _landFns.push(up); _queueFlush(); }   // the walk down is still on its way
    else up();
  }
  // No second Back came in time (review F5): step back up by itself — a walk
  // onto the step just left, nothing added — so a Back a minute later asks
  // again instead of leaving without a word.
  function _offFloorByTime() {
    _exitTimer = null;
    if (!_floorHold) return;
    _floorHold = false;
    if (_goInFlight || _fwdRoom() < 1) return;
    var c = _ctxNow();
    _landFns.push(function (failed) { if (!failed) _relabel(c); });
    _queueFwd();
  }
  var _TAP = { pointerup: 1, click: 1, keydown: 1 };
  var _NOT_A_TAP_KEY = { Alt: 1, AltGraph: 1, Control: 1, Meta: 1, Shift: 1, OS: 1, BrowserBack: 1, BrowserForward: 1, GoBack: 1 };
  function _touched(e) {
    // The app's own el.click() is not the person's finger (review F4).
    if (e && e.isTrusted === false) return;
    _noTouch = false;
    if (!_floorHold || !e || !_TAP[e.type]) return;
    if (e.type === 'keydown') { if (e.altKey || e.metaKey || e.ctrlKey || _NOT_A_TAP_KEY[e.key]) return; }   // Alt+Left IS a Back press
    else if (typeof e.button === 'number' && e.button > 2) return;                                          // so is a mouse's Back button
    _offFloorByTap();
  }
  function _queueFwd() { _fwdPending++; _queueFlush(); }
  function _runLand(failed) {
    var fns = _landFns; _landFns = [];
    for (var i = 0; i < fns.length; i++) { try { fns[i](!!failed); } catch (e) { console.warn('[BackStack] after a walk:', e); } }
  }
  var GO_ANSWER_MS = 1500;     // a same-document traversal answers in a few ms; this is a safety net
  function _queueBack() {
    if (_pushesDeferred > 0) { _pushesDeferred--; return; }   // an entry not yet added and a step owed cancel out
    _backsPending++;
    _queueFlush();
  }
  function _queueFlush() {
    if (_backFlushQueued) return;
    _backFlushQueued = true;
    try { Promise.resolve().then(_flushBacks); }
    catch (e) { setTimeout(_flushBacks, 0); }
  }
  function _flushBacks() {
    _backFlushQueued = false;
    if (_goInFlight) return;               // _onPopState (or the timer) flushes again
    var n = _backsPending - _fwdPending; _backsPending = 0; _fwdPending = 0;   // 2026-11-11: steps back less steps forward = ONE walk
    if (!n) { _runLand(true); return; }
    // never ask for more steps than the history holds — a traversal that goes
    // nowhere fires no popstate, and the count would stay up for good
    if (n > 0) { try { var have = (history.length || 1) - 1; if (n > have) n = have; } catch (e) {} }
    else { var room = _fwdRoom(); if (-n > room) n = -room; }   // 2026-11-11 (review F3): never walk forward onto nothing
    if (!n) { _runLand(true); return; }
    _ignorePops++;
    _goInFlight = true;
    _goTimer = setTimeout(_goUnanswered, GO_ANSWER_MS);
    try { history.go(-n); }
    catch (e) { _goAnswered(true); }
  }
  function _goAnswered(failed) {
    if (_goTimer) { clearTimeout(_goTimer); _goTimer = null; }
    _goUnanswered._again = false;
    _goInFlight = false;
    if (failed) _ignorePops = Math.max(0, _ignorePops - 1);
    while (_pushesDeferred > 0) {                 // the entries that waited for this answer
      _pushesDeferred--;
      try { _add(_stateFor(_stack.length ? _stack[_stack.length - 1].id : '', _depthNow() + 1)); }
      catch (e) { console.warn('[BackStack] pushState failed:', e); }
    }
    _runLand(failed);
    if (!failed) _payPage();                             // 2026-11-11: what waited for this walk to land (stay's restamp)
    if (_navDeferred) { var _nd = _navDeferred; _navDeferred = null; nav(_nd); }
    if (_backsPending > 0 || _fwdPending > 0) _queueFlush();
  }
  function _goUnanswered() {
    _goTimer = null;
    if (!_goInFlight) return;
    if (!_goUnanswered._again) {                  // one more turn: an answer already queued goes first
      _goUnanswered._again = true;
      _goTimer = setTimeout(_goUnanswered, 0);
      return;
    }
    _goUnanswered._again = false;
    _log('history.go went unanswered — taking back its ignore');
    _goAnswered(true);
  }
  // Review 2026-11-11 (F2): the item under a pop-up changed while the pop-up's
  // step was on top ("Which copy?" → the other copy). The page's own step is
  // re-labelled the moment the pop-up's rewind lands on it — else Back to that
  // page later showed the item it had BEFORE.
  function _payPage() {
    if (!_pageOwed) return;
    try {
      var cur = history.state;
      if (!_ours(cur) || _isBase(cur) || cur[CFG.stateKey]) return;   // still a pop-up's step: wait
      var c = _pageOwed; _pageOwed = null;
      if (cur.appPage !== c.appPage) return;
      history.replaceState(_pageState(c, _depthNow()), '', '');
    } catch (e) {}
  }
  // A pop-up's step also says which page (and item) it opened over, so a step
  // left behind (drop) still tells Back what to show.
  function _stateFor(id, d) { var st = _pageState(_ctxNow(), d || 0); st[CFG.stateKey] = id; return st; }

  function _log() {
    if (!CFG.debug) return;
    try { console.log.apply(console, ['[BackStack]'].concat([].slice.call(arguments))); } catch(e) {}
  }

  function _init() {
    if (_inited) return;
    _inited = true;
    window.addEventListener('popstate', _onPopState);
    // 2026-11-11: a touch on the page. Chrome itself counts a tap only when it
    // lands (pointerup), but a handler that opens something on the way DOWN
    // (touchstart / pointerdown) must still get its step: the tap lands a
    // moment later and Chrome then counts every step again.
    // (Only a FINISHED tap or a key lifts the exit hold — _touched.)
    ['pointerdown', 'touchstart', 'pointerup', 'mousedown', 'keydown', 'click'].forEach(function (ev) {
      try { window.addEventListener(ev, _touched, { capture: true, passive: true }); } catch (e) { window.addEventListener(ev, _touched, true); }
    });
    _log('initialized');
  }

  function _onPopState(e) {
    // We called history.back() ourselves — swallow exactly one popstate.
    if (_ignorePops > 0) {
      _ignorePops--;
      _log('ignoring self-triggered popstate');
      _landed();
      if (_goInFlight) _goAnswered(false);
      // Session 159: also stop propagation so app.js's dashboard back handler
      // doesn't see this and flash "Press back again to exit" after wizard close.
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      return;
    }
    _noTouch = true;               // 2026-11-11: the person's own Back (or Forward) — no step is added until they touch the page
    _landed();
    if (_floorHold && !_isBase(e.state)) _floorOff();   // they walked somewhere else (Forward): the exit hold is over
    if (!_stack.length) {
      // Stack is empty — let app.js (or any other) popstate handler run.
      return;
    }
    var top = _stack.pop();
    _log('popstate → close', top.id, 'stack size now', _stack.length);
    _dispatching = true; _rearmed = false; _dispatchOwn = (top.own === 0) ? 0 : 1;
    try { top.closeFn && top.closeFn(); }
    catch (err) { console.warn('[BackStack] closeFn error for', top.id, err); }
    _dispatching = false;
    // 2026-11-11: its handler opened it again (the Add window stepping back),
    // or it never had a step of its own (this Back used up a page's step):
    // walk forward onto the step this Back just left. Nothing is added.
    if (_rearmed || top.own === 0) {
      if (_fwdRoom() > 0) _queueFwd();
      else if (_rearmed && _stack.length) _stack[_stack.length - 1].own = 0;   // review F3: no step above to take back (a Forward press) — it holds none
    } else {
      _payPage();
      // The floor is a place to wait for the second Back, nothing else: a
      // pop-up closed onto it walks back up onto the step just left.
      if (_isBase(e.state) && !_floorHold && _fwdRoom() > 0) _queueFwd();
    }
    _rearmed = false;
    // Prevent app.js's own popstate handler from also firing and
    // treating this as a navigation event.
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }
  }

  // Public — call when a modal/overlay opens.
  function push(id, closeFn) {
    _init();
    if (!id) { console.warn('[BackStack] push requires an id'); return; }
    if (typeof closeFn !== 'function') {
      console.warn('[BackStack] push requires a closeFn for', id);
      return;
    }
    // De-dupe: if this id is already somewhere in the stack (shouldn't
    // happen, but defensive), remove the old entry first.
    for (var i = _stack.length - 1; i >= 0; i--) {
      if (_stack[i].id === id) {
        // 2026-11-11 (review F2): the SAME pop-up registered twice (the copy
        // picker is wired, and its click-outside binding wires it again) used
        // to get a second history step; only one was ever rewound, and the
        // one left behind sat between the page and its own step. One pop-up,
        // one step: the entry already there changes hands.
        var was = _stack.splice(i, 1)[0];
        _stack.push({ id: id, closeFn: closeFn, own: was.own });
        _log('push', id, '(already open — its step is kept)');
        return;
      }
    }
    var own = 1;
    var cur = null; try { cur = history.state; } catch (e) {}
    if (_dispatching) {
      // 2026-11-11 (re-arm): opened again by the Back that is closing it — it
      // takes back the step that Back just left (_onPopState walks forward).
      _rearmed = true; own = _dispatchOwn;
    } else if (_backsPending > 0) {
      // 2026-11-07: a step still owed + a new entry = the top entry changes hands, no traversal
      _backsPending--;
      try { history.replaceState(_stateFor(id, _depthNow()), '', ''); }
      catch (e) { console.warn('[BackStack] replaceState failed:', e); }
    } else if (_noTouch && !(_ours(cur) && cur.appPage === 'base')) {
      // 2026-11-11: no touch since a Back press — a step added now would make
      // Chrome skip every step of the app. On its own old step (a view the
      // person came back to, e.g. My Sets under a set's page) it owns that
      // step again; anywhere else it opens with no step of its own.
      own = (_ours(cur) && cur[CFG.stateKey] === id) ? 1 : 0;
    } else if (_goInFlight) {
      _pushesDeferred++;                          // 2026-11-09: added the moment the traversal on its way lands
    } else {
      try { _add(_stateFor(id, _depthNow() + 1)); }
      catch (e) { console.warn('[BackStack] pushState failed:', e); }
    }
    _stack.push({ id: id, closeFn: closeFn, own: own });
    _log('push', id, 'stack size now', _stack.length);
  }

  // Public — call when a modal closes voluntarily (X button, Finish, ESC).
  // Rewinds the history entry we pushed so the back stack stays balanced.
  function pop(id) {
    if (!_stack.length) return;
    var removed = false, gone = null;
    if (id) {
      for (var i = _stack.length - 1; i >= 0; i--) {
        if (_stack[i].id === id) { gone = _stack.splice(i, 1)[0]; removed = true; break; }
      }
    } else {
      gone = _stack.pop();
      removed = true;
    }
    if (!removed) {
      _log('pop', id, '— not found on stack (already closed via back button?)');
      return;
    }
    _log('pop', id || '(top)', 'stack size now', _stack.length);
    // Rewind one history step to match the pushState we did on open,
    // so the next back press isn't a no-op for the user. Gathered with any
    // other pop of this tick into ONE traversal (finding 17, above).
    if (gone && gone.own === 0) return;           // 2026-11-11: it never had a step of its own — nothing to rewind
    _queueBack();
  }

  // Public — one-line wiring for modals that close by REMOVING their root
  // element from the DOM (the app's standard pattern). Call once right
  // after appending the element:
  //     BackStack.wire(overlayEl);   // or BackStack.wire('modal-id')
  // Device back → removes the element. Any OTHER close path (Cancel button,
  // tap-outside, save handler) is detected with a MutationObserver on
  // document.body and pops the stack automatically — existing close code
  // does not need to change. (v0.9.805, TODO-012)
  var _autoWireN = 0;
  // v0.9.1791: an optional closeFn. Without one, Back removes the element,
  // which is right for an overlay that is only markup. Some overlays have
  // CLEANUP to do on the way out — a chooser that resets state, a picker that
  // clears a selection, a modal that hides rather than removes — and removing
  // the element behind their backs skips it. Those pass their own close here
  // (bindOverlayClose forwards the one its caller already had), so Back does
  // exactly what the ✕ does. One close path, not two that can drift.
  function wire(elOrId, closeFn) {
    var el = (typeof elOrId === 'string') ? document.getElementById(elOrId) : elOrId;
    if (!el) { _log('wire: element not found', elOrId); return; }
    var id = el.id || ('_bs-auto-' + (++_autoWireN));
    var byBack = false;
    var mine = null;
    var obs = new MutationObserver(function () {
      if (document.body.contains(el)) return;
      try { obs.disconnect(); } catch (e) {}
      // v0.9.2038 (Workbench check 2026-10-28, C22): pop only OUR entry. An
      // overlay re-opened under the same id (remove the old one, append a new
      // one, wire it) used to have the OLD element's observer fire after the
      // new push and pop the NEW entry by id — so the device Back button no
      // longer closed the overlay on screen and moved the page underneath.
      if (!byBack && mine && _stack.indexOf(mine) >= 0) pop(id);
    });
    push(id, function () {
      byBack = true;
      try { obs.disconnect(); } catch (e) {}
      if (typeof closeFn === 'function') { try { closeFn(); } catch (e) {} return; }
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    mine = (_stack.length && _stack[_stack.length - 1].id === id) ? _stack[_stack.length - 1] : null;
    obs.observe(document.body, { childList: true });
  }

  // Public — is this id currently on the stack?
  function has(id) {
    for (var i = 0; i < _stack.length; i++) {
      if (_stack[i].id === id) return true;
    }
    return false;
  }

  // Public — forget one entry WITHOUT rewinding history. For an in-page view
  // the person left by opening another page: that page's own history entry
  // now sits above ours, so pop()'s rewind would undo the wrong step. The
  // step left behind is an ordinary one the app's own Back handling walks.
  // 2026-11-08 (mysets: My Sets' Back entry when a set's page opens on top).
  function drop(id) {
    for (var i = _stack.length - 1; i >= 0; i--) {
      if (_stack[i].id === id) { _stack.splice(i, 1); _log('drop', id, 'stack size now', _stack.length); return true; }
    }
    return false;
  }

  // Public — how many entries on the stack right now.
  function size() { return _stack.length; }

  // ── 2026-11-11 (backtruth): the page's own steps ─────────────────────────
  // Public — a page opened (app.js showPage, the ONE caller). c = { appPage,
  // item }. Adds a step only when the person touched the page to get here;
  // the same page shown again (a repaint, the next item with the arrows)
  // re-labels its own step — one step per page, as the old visit list had.
  function nav(c) {
    _init();
    c = c || {};
    var cur = null; try { cur = history.state; } catch (e) {}
    var ours = _ours(cur), d = _depthNow();
    var curBack = ours ? cur[CFG.stateKey] : '';
    var samePage = ours && cur.appPage === c.appPage;
    var newItem = samePage && (cur.item || 0) !== (c.item || 0);
    if (curBack && has(curBack)) {                // an open pop-up's step is on top
      if (samePage) { _pageOwed = newItem ? c : null; return; }   // its own page drawn again underneath (a new item: its step is re-labelled when the pop-up closes)
    } else if (curBack && samePage && (_backsPending > 0 || _goInFlight)) {
      _pageOwed = newItem ? c : null;
      return;                                     // a pop-up over this page is closing: its rewind lands on the page's own step
    }
    _pageOwed = null;
    try {
      if (_backsPending > 0) {                    // a closing pop-up's step becomes this page's
        _backsPending--;
        history.replaceState(_pageState(c, d), '', '');
      } else if (_goInFlight) {
        _navDeferred = c;                         // added the moment the walk on its way lands
      } else if (ours && cur.appPage !== 'base' && (_noTouch || samePage || (curBack && !has(curBack)))) {
        history.replaceState(_pageState(c, d), '', '');   // no touch since a Back · the same page · a step left behind
      } else {
        _add(_pageState(c, d + 1));
      }
    } catch (e) { console.warn('[BackStack] nav failed:', e); }
  }
  // Public — a Back press was answered WITHOUT leaving (a pop-up with no step
  // closed, the Dashboard shown from the floor): walk forward onto the step
  // that Back just left, and, when a page is named, label that step with it.
  function stay(c) {
    if (c) _landFns.push(function (failed) { if (!failed) _relabel(c); });
    _queueFwd();
  }
  // Public — walk down to the floor (the Dashboard's "press back again to
  // exit": the next Back then leaves the app). d = how far above it we are.
  function toFloor(d) {
    d = parseInt(d, 10) || 0;
    _floorHold = true;
    if (_exitTimer) clearTimeout(_exitTimer);
    _exitTimer = setTimeout(_offFloorByTime, CFG.exitMs);
    if (d <= 0) return;                           // already on it
    _backsPending += d;
    _queueFlush();
  }
  // Public — start-up (app.js _initBackButton): the floor and the first page.
  // After a reload inside a running session the steps below are still there:
  // the step we are on becomes the first page at the height it already had,
  // and nothing is added.
  function seed(c) {
    _init();
    var cur = null; try { cur = history.state; } catch (e) {}
    try {
      if (_ours(cur) && cur.s !== _load && cur.appPage && cur.appPage !== 'base' && cur.d >= 1) {
        history.replaceState(_pageState(c, cur.d), '', '');
        _lastD = cur.d;
        return;
      }
      history.replaceState({ rr: 1, s: _load, appPage: 'base', item: 0, d: 0 }, '', '');
      _add(_pageState(c, 1));
    } catch (e) { console.warn('[BackStack] seed failed:', e); }
  }

  // Public — drop everything without calling closeFns (used on sign-out).
  function clear() {
    _stack.length = 0;
    _pageOwed = null;
    _log('cleared');
  }

  // Init eagerly so pre-auth modals are covered.
  _init();

  // ══ v0.9.2070 (known-problems sweep A4) — WHILE A POP-UP IS OPEN, THE WINDOW HOLDS STILL ══
  // [stated] Brad 2026-10-30: "yes" — the crop screen's rule (v0.9.1468) for every pop-up.
  // The app's pages scroll inside their own box, so when a list in a pop-up
  // reached its end the pull carried on to the WINDOW: on an iPhone the whole
  // screen bounced, and in Safari a pull down at a list's top reloaded the
  // app (a half-filled Add, gone). Now, while any pop-up is open, <html> wears
  // POP.cls and app.css holds the window still (overscroll-behavior: none) —
  // no bounce, no pull-down reload. The pages keep their pull-down reload, as
  // Brad chose. ONE decider, here: _popOpen(). A pop-up is anything pinned
  // (position: fixed) that covers at least POP.minArea of the window, can be
  // touched, and sits on <body>, in the page box (.main — sheets mount there
  // for the light theme), is a .modal-overlay, or is pinned by its own style
  // wherever it is mounted. New pop-ups need no wiring.
  // tests/window_still_2070_tests.js holds it to that.
  var POP = { cls: 'rr-pop-open', minArea: 0.35 };
  var POP_SEL = '.modal-overlay, [style*="position:fixed"], [style*="position: fixed"]';
  function _popLike(n) { return !!(n && n.nodeType === 1 && n.matches && n.matches(POP_SEL)); }
  // a node that IS a pop-up or HOLDS one — a pop-up closed by removing the box it sits in counts too
  function _popIn(n) { return _popLike(n) || !!(n && n.nodeType === 1 && n.querySelector && n.querySelector(POP_SEL)); }
  function _isOpenPop(el) {
    if (!el || el.nodeType !== 1 || !el.getBoundingClientRect) return false;
    var c = getComputedStyle(el);
    if (c.position !== 'fixed' || c.display === 'none' || c.visibility === 'hidden' || c.pointerEvents === 'none') return false;
    var r = el.getBoundingClientRect(), W = window.innerWidth || 1, H = window.innerHeight || 1;
    var w = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
    return (w * h) / (W * H) >= POP.minArea;
  }
  function _popCandidates() {
    var out = [], b = document.body, m = document.querySelector('.main');
    if (b) out = out.concat([].slice.call(b.children));
    if (m) out = out.concat([].slice.call(m.children));
    return out.concat([].slice.call(document.querySelectorAll(POP_SEL)));
  }
  function _popOpen() {
    var c = _popCandidates();
    for (var i = 0; i < c.length; i++) if (_isOpenPop(c[i])) return true;
    return false;
  }
  // ══ 2026-11-01 — THE BOTTOM BAR'S ROOM ([stated] Brad 20:28 CT, his iPhone: "you can't
  // see the photo id button") ══════════════════════════════════════════════════
  // On a phone the menu bar (.mobile-nav, layer 800) is pinned over every pop-up
  // (layer 200), so a pop-up must END above it. app.css used a fixed guess (92px)
  // — right for an Android bar (85px), wrong for an iPhone, whose bar also covers
  // the home strip, so the Add box's Photo ID / ✕ / Next sat under the bar.
  // ONE number now, measured here: how much of the bottom of the window the bar
  // really covers (0 when it is hidden or on a computer), kept in ONE CSS setting
  // (BAR.prop on <html>) that app.css reads everywhere it leaves room for the bar.
  // Measured whenever the pop-up watcher looks (a pop-up opens or closes, the app
  // signs in, the window resizes or turns). tests/apple_screens_tests.js.
  var BAR = { prop: '--rr-bottom-bar', sel: '.mobile-nav' };
  function _barCover() {
    var n = document.querySelector(BAR.sel);
    if (!n || !n.getBoundingClientRect) return 0;
    var c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || c.position !== 'fixed') return 0;
    var r = n.getBoundingClientRect(), H = window.innerHeight || 0;
    if (!r.height || r.top >= H) return 0;
    return Math.max(0, Math.round(H - r.top));
  }
  function rrBottomBarMeasure() {
    var px = 0;
    try {
      px = _barCover();
      var root = document.documentElement;
      if (root.style.getPropertyValue(BAR.prop) !== px + 'px') root.style.setProperty(BAR.prop, px + 'px');
    } catch (e) {}
    return px;
  }
  var _popPending = false;
  function _popCheck() {
    _popPending = false;
    rrBottomBarMeasure();
    try { document.documentElement.classList.toggle(POP.cls, _popOpen()); } catch (e) {}
  }
  function _popSchedule() {
    if (_popPending) return;
    _popPending = true;
    (window.requestAnimationFrame || window.setTimeout)(_popCheck, 0);
  }
  function _popRelevant(muts) {   // a pop-up came, went, or changed how it shows — not a list filling up inside one
    for (var i = 0; i < muts.length; i++) {
      var mu = muts[i], t = mu.target;
      if (t === document.body || (t.classList && t.classList.contains('main'))) return true;
      if (mu.type === 'attributes') {
        if (_popLike(t) || (t.parentNode && (t.parentNode === document.body || (t.parentNode.classList && t.parentNode.classList.contains('main'))))) return true;
        continue;
      }
      var j;
      for (j = 0; j < mu.addedNodes.length; j++) if (_popIn(mu.addedNodes[j])) return true;
      for (j = 0; j < mu.removedNodes.length; j++) if (_popIn(mu.removedNodes[j])) return true;
    }
    return false;
  }
  function _popWatch() {
    try {
      new MutationObserver(function (m) { if (_popRelevant(m)) _popSchedule(); })
        .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    } catch (e) {}
    window.addEventListener('resize', _popSchedule);
    window.addEventListener('orientationchange', _popSchedule);
    try { if (window.visualViewport) window.visualViewport.addEventListener('resize', _popSchedule); } catch (e) {}
    _popSchedule();
  }
  if (document.body) _popWatch(); else document.addEventListener('DOMContentLoaded', _popWatch);
  global.rrPopOpen = _popOpen;
  global.RR_POP = POP;
  global.rrBottomBarMeasure = rrBottomBarMeasure;
  global.RR_BOTTOM_BAR = BAR;

  global.BackStack = {
    push:  push,
    pop:   pop,
    wire:  wire,
    has:   has,
    drop:  drop,
    size:  size,
    clear: clear,
    nav:   nav,       // 2026-11-11 (backtruth)
    stay:  stay,
    toFloor: toFloor,
    seed:  seed,
    setCtx: function (fn) { _ctx = (typeof fn === 'function') ? fn : null; },
    load:  function () { return _load; },
    noTouch: function () { return _noTouch; },
    _cfg:  CFG,   // exposed for tests / one-line tweaks
  };
})(window);
