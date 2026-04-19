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
  var _ignoreNextPopstate = false; // set when WE call history.back() in pop()
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
    if (_ignoreNextPopstate) {
      _ignoreNextPopstate = false;
      _log('ignoring self-triggered popstate');
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
    _ignoreNextPopstate = true;
    try { history.back(); }
    catch (e) { _ignoreNextPopstate = false; }
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

  global.BackStack = {
    push:  push,
    pop:   pop,
    has:   has,
    size:  size,
    clear: clear,
    _cfg:  CFG,   // exposed for tests / one-line tweaks
  };
})(window);
