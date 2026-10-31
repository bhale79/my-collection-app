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
  };

  var _stack = [];               // array of { id: string, closeFn: function }
  // v0.9.1936: a COUNT, not a flag. Each history.back() we make ourselves (in
  // pop) fires one popstate a moment later. When two overlays closed in the
  // same instant — the "Add a picture" chooser stepping aside for the Google
  // Photos waiting panel, and the panel coming straight down again — both
  // calls set the same true, the first popstate cleared it, and the SECOND
  // was taken for the user pressing Back: it closed whatever sat below
  // (pic_first_tests G2 caught it — the picture box vanished).
  var _ignorePops = 0;             // self-made history.back() calls still to come
  var _inited = false;

  function _log() {
    if (!CFG.debug) return;
    try { console.log.apply(console, ['[BackStack]'].concat([].slice.call(arguments))); } catch(e) {}
  }

  function _init() {
    if (_inited) return;
    _inited = true;
    window.addEventListener('popstate', _onPopState);
    _log('initialized');
  }

  function _onPopState(e) {
    // We called history.back() ourselves — swallow exactly one popstate.
    if (_ignorePops > 0) {
      _ignorePops--;
      _log('ignoring self-triggered popstate');
      // Session 159: also stop propagation so app.js's dashboard back handler
      // doesn't see this and flash "Press back again to exit" after wizard close.
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      return;
    }
    if (!_stack.length) {
      // Stack is empty — let app.js (or any other) popstate handler run.
      return;
    }
    var top = _stack.pop();
    _log('popstate → close', top.id, 'stack size now', _stack.length);
    try { top.closeFn && top.closeFn(); }
    catch (err) { console.warn('[BackStack] closeFn error for', top.id, err); }
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
      if (_stack[i].id === id) { _stack.splice(i, 1); break; }
    }
    var state = {};
    state[CFG.stateKey] = id;
    try { history.pushState(state, '', ''); }
    catch (e) { console.warn('[BackStack] pushState failed:', e); }
    _stack.push({ id: id, closeFn: closeFn });
    _log('push', id, 'stack size now', _stack.length);
  }

  // Public — call when a modal closes voluntarily (X button, Finish, ESC).
  // Rewinds the history entry we pushed so the back stack stays balanced.
  function pop(id) {
    if (!_stack.length) return;
    var removed = false;
    if (id) {
      for (var i = _stack.length - 1; i >= 0; i--) {
        if (_stack[i].id === id) { _stack.splice(i, 1); removed = true; break; }
      }
    } else {
      _stack.pop();
      removed = true;
    }
    if (!removed) {
      _log('pop', id, '— not found on stack (already closed via back button?)');
      return;
    }
    _log('pop', id || '(top)', 'stack size now', _stack.length);
    // Rewind one history step to match the pushState we did on open,
    // so the next back press isn't a no-op for the user.
    _ignorePops++;
    try { history.back(); }
    catch (e) { _ignorePops = Math.max(0, _ignorePops - 1); }
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

  // Public — how many entries on the stack right now.
  function size() { return _stack.length; }

  // Public — drop everything without calling closeFns (used on sign-out).
  function clear() {
    _stack.length = 0;
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
  var _popPending = false;
  function _popCheck() {
    _popPending = false;
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
    _popSchedule();
  }
  if (document.body) _popWatch(); else document.addEventListener('DOMContentLoaded', _popWatch);
  global.rrPopOpen = _popOpen;
  global.RR_POP = POP;

  global.BackStack = {
    push:  push,
    pop:   pop,
    wire:  wire,
    has:   has,
    size:  size,
    clear: clear,
    _cfg:  CFG,   // exposed for tests / one-line tweaks
  };
})(window);
