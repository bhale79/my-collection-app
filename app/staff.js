// ════════════════════════════════════════════════════════════════════════
// staff.js — TRR Pro STAFF PINs: one business account, each person a PIN.
// THE ONE "who is working" door, and the roles door.
// ════════════════════════════════════════════════════════════════════════
// PLAN_2026-11-10_TRR_PRO_R9_STAFF_ROUTE_B.md. [stated] Brad 2026-11-11 06:35
// CT "i like the employee pin id and just one account. the employee pin
// should be assigned by management and they should have the ability to turn
// it off or on at anytime"; 06:37 "owners and managers"; 06:39 "switching
// on/off needs a connection"; 06:41 "yes".
//
// Why PINs and not each person's own Google sign-in: Google's narrow
// permission (drive.file) only lets each person's copy of the app see files
// THAT person made or picked one by one — a folder pick does not open what
// is inside (hand-test T-2026-11-10-04, 2026-11-11). So the business's
// devices sign in with the business's ONE Google account, and each person
// who works there types their own PIN.
//
// The list lives in the relay (v5.1: staff_list / staff_check / staff_save /
// staff_switch / staff_settings), which ENFORCES who may change whom. This
// device keeps a copy (RR_STAFF.cacheKey) so a PIN still works with no
// signal; someone turned off is stopped the next time this device reaches
// the relay (every RR_STAFF.pollMs while open).
//
// Doors kept here, and nowhere else:
//   rrStaffOn()          is this business using staff PINs at all?
//   rrStaffNow()         who is working on this device ({id,name,role}|null)
//   rrStaffCan(what)     may they? (true for everyone when PINs are not in use)
//   rrStaffGate(what)    rrStaffCan + the "ask a manager" message. Every
//                        function in RR_STAFF.gates begins with it
//                        (tests/staff_pins_tests.js proves it on a plant).
//   rrWhoNow()           the name a save is stamped with (Movement Log)
// A business that has not made its first person works exactly as before.
// ════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function C() { return (typeof RR_STAFF !== 'undefined') ? RR_STAFF : (root.RR_STAFF || { may: {}, words: { errors: {} } }); }
  function W(k, vars) {
    var w = C().words || {};
    var t = String(w[k] == null ? k : w[k]);
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function errWord(code) { var e = (C().words || {}).errors || {}; return e[code] || W('failed'); }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function st() { try { return (typeof state !== 'undefined' && state) || root.state || {}; } catch (e) { return root.state || {}; } }
  function _ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function _offline() {
    try { if (typeof _rrOfflineNow === 'function') return !!_rrOfflineNow(); } catch (e) {}
    try { return root.navigator && root.navigator.onLine === false; } catch (e) { return false; }
  }
  function _proOn() { try { return typeof rrFeatureOn === 'function' && !!rrFeatureOn(C().feature); } catch (e) { return false; } }
  function _acct() { var u = st().user || {}; return String(u.email || '').toLowerCase(); }

  // ── this device's copy of the list ──────────────────────────────────────
  var _list = null;            // { acct, people:[{id,name,role,on,check}], salt, idleMin, updated, at }
  function _loadList() {
    var ls = _ls(); if (!ls) return null;
    try {
      var o = JSON.parse(ls.getItem(C().cacheKey) || 'null');
      return (o && o.acct && o.acct === _acct() && Array.isArray(o.people)) ? o : null;
    } catch (e) { return null; }
  }
  function _saveList() { var ls = _ls(); if (!ls || !_list) return; try { ls.setItem(C().cacheKey, JSON.stringify(_list)); } catch (e) {} }
  function _takeAnswer(r) {
    _list = { acct: _acct(), people: (r.people || []).map(function (p) { return { id: String(p.id), name: String(p.name || ''), role: String(p.role || 'staff'), on: !!p.on, check: String(p.check || '') }; }),
              salt: String(r.salt || ''), idleMin: Number(r.idleMin) || 10, updated: String(r.updated || ''), at: Date.now() };
    _saveList();
  }
  function _person(id) { return _list ? (_list.people.filter(function (p) { return p.id === id; })[0] || null) : null; }

  function rrStaffOn() {
    if (!_proOn()) return false;
    if (!_list || _list.acct !== _acct()) _list = _loadList();
    return !!(_list && _list.people.length);
  }

  // ── who is working on this device ───────────────────────────────────────
  var _who = null;             // { id, name, role }
  var _lastActive = Date.now();
  function _saveWho() {
    var ls = _ls(); if (!ls) return;
    try {
      if (_who) ls.setItem(C().whoKey, JSON.stringify({ acct: _acct(), id: _who.id, at: _lastActive }));
      else ls.removeItem(C().whoKey);
    } catch (e) {}
  }
  function _idleMs() { return Math.max(1, Number(_list && _list.idleMin) || 10) * 60000; }
  function _restoreWho() {
    var ls = _ls(); if (!ls) return;
    try {
      var o = JSON.parse(ls.getItem(C().whoKey) || 'null');
      if (!o || o.acct !== _acct()) return;
      var p = _person(String(o.id));
      if (p && p.on && (Date.now() - Number(o.at || 0)) < _idleMs()) { _who = { id: p.id, name: p.name, role: p.role }; _lastActive = Number(o.at) || Date.now(); }
    } catch (e) {}
  }
  function rrStaffNow() {
    if (!rrStaffOn() || !_who) return null;
    var p = _person(_who.id);
    return (p && p.on) ? { id: p.id, name: p.name, role: p.role } : null;
  }
  function rrStaffCan(what) {
    if (!rrStaffOn()) return true;                     // PINs not in use: everything as before
    var me = rrStaffNow();
    if (!me) return false;
    return ((C().may || {})[me.role] || []).indexOf(String(what)) >= 0;
  }
  function rrStaffGate(what) {
    if (rrStaffCan(what)) return true;
    var me = rrStaffNow();
    if (!me) { _showPin(); return false; }
    var ownerOnly = ((C().may || {}).manager || []).indexOf(String(what)) < 0;
    toast(W('notAllowed', { name: me.name, who: ownerOnly ? W('askOwner') : W('askManager') }), 4500, true);
    return false;
  }
  function rrWhoNow() {
    var me = rrStaffNow();
    if (me) return me.name;
    var u = st().user || {};
    return String(u.email || u.name || '');
  }

  // ── PIN checks (same scramble as relay v5.1's pin_check) ─────────────────
  async function _sha40(text) {
    var bytes = new TextEncoder().encode(text);
    var buf = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('').substring(0, 40);
  }
  function _checkFor(id, pin) { return _sha40('rrpin|' + (_list ? _list.salt : '') + '|' + id + '|' + pin); }
  async function _whoseLocal(pin) {
    if (!_list) return null;
    for (var i = 0; i < _list.people.length; i++) {
      var p = _list.people[i];
      if (p.check && (await _checkFor(p.id, pin)) === p.check) return p;
    }
    return null;
  }
  // The relay's PIN rule, so "make one up" never offers one it would refuse.
  function rrStaffPinProblem(pin) {
    var s = String(pin == null ? '' : pin);
    if (!new RegExp('^[0-9]{' + C().pinMin + ',' + C().pinMax + '}$').test(s)) return 'pin_format';
    if (/^(\d)\1+$/.test(s)) return 'pin_easy';
    var up = true, down = true;
    for (var i = 1; i < s.length; i++) { var d = Number(s[i]) - Number(s[i - 1]); if (d !== 1) up = false; if (d !== -1) down = false; }
    if (up || down) return 'pin_easy';
    if (s.length % 2 === 0 && s === s.substring(0, 2).repeat(s.length / 2)) return 'pin_easy';
    if (['2580', '0852', '1470', '0741', '3690', '0963', '1397', '7931', '1379', '9731'].indexOf(s) >= 0) return 'pin_easy';
    return '';
  }
  async function rrStaffMakePin() {
    for (var n = 0; n < 200; n++) {
      var a = new Uint32Array(1); root.crypto.getRandomValues(a);
      var pin = String(a[0] % 10000); while (pin.length < 4) pin = '0' + pin;
      if (rrStaffPinProblem(pin)) continue;
      if (await _whoseLocal(pin)) continue;
      return pin;
    }
    return '';
  }

  // ── the PIN screen ──────────────────────────────────────────────────────
  var _entry = '';
  var _wrong = { n: 0, until: 0 };
  var _trying = false;
  function _pinEl() { return document.getElementById('rr-staff-pin'); }
  function _hidePin() { var d = _pinEl(); if (d) d.remove(); try { document.removeEventListener('keydown', _pinKeys, true); } catch (e) {} }
  function _dots() {
    var box = document.getElementById('rr-staff-dots'); if (!box) return;
    var n = Math.max(_entry.length, C().pinMin);
    var h = '';
    for (var i = 0; i < n; i++) h += '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;margin:0 5px;border:2px solid var(--text);' + (i < _entry.length ? 'background:var(--text)' : '') + '"></span>';
    box.innerHTML = h;
  }
  function _say(msg, bad) { var m = document.getElementById('rr-staff-msg'); if (m) { m.textContent = msg || ''; m.style.color = bad ? 'var(--t-danger)' : 'var(--text-dim)'; } }
  function _showPin(msg) {
    if (typeof document === 'undefined' || !rrStaffOn()) return;
    _entry = '';
    var old = _pinEl();
    if (!old) {
      var key = function (label, act, aria) {
        return '<button type="button" data-pin-key="' + esc(act) + '"' + (aria ? ' aria-label="' + esc(aria) + '"' : '') +
          ' style="min-width:72px;min-height:64px;border-radius:14px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:1.6rem;font-weight:700;font-family:var(--font-body);cursor:pointer">' + esc(label) + '</button>';
      };
      var pad = '';
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (d) { pad += key(d, d); });
      pad += key(W('clear'), 'clear') + key('0', '0') + key('⌫', 'back', W('back'));
      var d = document.createElement('div');
      d.id = 'rr-staff-pin';
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-modal', 'true');
      d.setAttribute('aria-labelledby', 'rr-staff-pin-title');
      d.style.cssText = 'position:fixed;inset:0;z-index:9800;background:var(--bg);color:var(--text);display:flex;align-items:center;justify-content:center;padding:1rem;overflow:auto';
      d.innerHTML = '<div style="width:100%;max-width:340px;text-align:center;font-family:var(--font-body)">' +
        '<div id="rr-staff-pin-title" style="font-family:var(--font-head);font-size:1.6rem;font-weight:700;margin-bottom:0.3rem">' + esc(W('pinTitle')) + '</div>' +
        '<div style="color:var(--text-dim);margin-bottom:0.9rem">' + esc(W('pinHelp')) + '</div>' +
        '<div id="rr-staff-dots" aria-hidden="true" style="min-height:22px;margin-bottom:0.6rem"></div>' +
        '<div id="rr-staff-msg" role="status" aria-live="polite" style="min-height:1.4em;margin-bottom:0.6rem;font-size:0.95rem"></div>' +
        '<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:0.6rem;justify-items:center">' + pad + '</div>' +
        '<button type="button" data-pin-key="enter" style="margin-top:0.9rem;width:100%;min-height:56px;border-radius:14px;border:none;background:var(--accent);color:var(--on-accent);font-size:1.2rem;font-weight:700;cursor:pointer">' + esc(W('enter')) + '</button>' +
        '<button type="button" id="rr-staff-forgot" style="margin-top:0.8rem;min-height:44px;background:none;border:none;color:var(--text-dim);text-decoration:underline;font-size:0.95rem;cursor:pointer;font-family:var(--font-body)">' + esc(W('forgot')) + '</button>' +
        '</div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-pin-key]') : null;
        if (b) _press(b.getAttribute('data-pin-key'));
        if (ev.target && ev.target.id === 'rr-staff-forgot') _resetOpen();
      });
      // Back never leaves the PIN screen (nothing behind it may be used yet).
      if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d, function () {}); } catch (e) {} }
      try { document.addEventListener('keydown', _pinKeys, true); } catch (e) {}
    }
    // a field left focused behind the PIN screen must not take the keyboard
    try { var ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !(_resetEl() && _resetEl().contains(ae)) && ae.blur) ae.blur(); } catch (eB) {}
    _dots();
    _say(msg || '', !!msg);
  }
  function _pinKeys(ev) {
    if (!_pinEl()) return;
    if (_resetEl()) return;                                            // typing into the Owner reset box
    var k = ev.key;
    if (/^[0-9]$/.test(k)) { _press(k); ev.preventDefault(); }
    else if (k === 'Backspace') { _press('back'); ev.preventDefault(); }
    else if (k === 'Enter') { _press('enter'); ev.preventDefault(); }
  }
  function _press(k) {
    if (_trying) return;
    if (k === 'clear') _entry = '';
    else if (k === 'back') _entry = _entry.slice(0, -1);
    else if (k === 'enter') { rrStaffTryPin(_entry); return; }
    else if (/^[0-9]$/.test(k) && _entry.length < C().pinMax) _entry += k;
    _dots();
    _say('');
  }
  function _accept(p) {
    _who = { id: p.id, name: p.name, role: p.role };
    _lastActive = Date.now();
    _wrong = { n: 0, until: 0 };
    _saveWho();
    _hidePin();
    _repaint();
  }
  // Enter: which person is this PIN? Online, the relay has the last word
  // (and counts wrong tries); with no signal, this device's copy decides.
  async function rrStaffTryPin(pin) {
    if (_trying) return null;
    pin = String(pin || '');
    if (Date.now() < _wrong.until) { _entry = ''; _dots(); _say(W('pinWait'), true); return null; }
    _trying = true;
    try {
      var p = await _whoseLocal(pin);
      if (p && !p.on) { _entry = ''; _dots(); _say(W('pinOff'), true); return null; }
      // 2026-11-13: this device's copy knows no one with this PIN. Online, the relay
      // has the last word — the copy may be out of date (or, as on the first Pro
      // business, hold a check made with another salt), and an Owner must never be
      // told "wrong" by a stale copy. Relay v5.5 answers staff_who; an older relay
      // answers "Unknown action" and this device's copy decides, as before.
      if (!p && !_offline()) {
        var w = await _post({ action: 'staff_who', pin: pin });   // (staff_who — relay v5.5)
        if (w && w.status === 200 && w.id) {
          if (w.people) _takeAnswer(w);
          _accept({ id: String(w.id), name: String(w.name || ''), role: String(w.role || 'staff') });
          return rrStaffNow();
        }
        if (w && w.status === 429) { _entry = ''; _dots(); _say(W('pinWait'), true); return null; }
        if (w && w.message === 'not_allowed') { _entry = ''; _dots(); _say(W('pinOff'), true); return null; }
      }
      if (!_offline()) _say(W('checking'));                       // the relay can take a few seconds
      if (p && !_offline()) {
        var r = await vaultPost({ action: 'staff_check', actorId: p.id, actorPin: pin });
        if (r && r.status === 200) { _accept({ id: r.id || p.id, name: r.name || p.name, role: r.role || p.role }); return rrStaffNow(); }
        if (r && r.status === 429) { _entry = ''; _dots(); _say(W('pinWait'), true); return null; }
        if (r && r.message === 'wrong_pin') {
          // this device's copy named the wrong person (a PIN given to someone else since):
          // the relay says whose it is now
          var w2 = await _post({ action: 'staff_who', pin: pin });
          if (w2 && w2.status === 200 && w2.id) {
            if (w2.people) _takeAnswer(w2);
            _accept({ id: String(w2.id), name: String(w2.name || ''), role: String(w2.role || 'staff') });
            return rrStaffNow();
          }
        }
        if (r && (r.message === 'not_allowed' || r.message === 'wrong_pin')) {
          await rrStaffRefresh();                       // this device's copy was out of date
          _entry = ''; _dots();
          _say(r.message === 'not_allowed' ? W('pinOff') : W('pinWrong'), true);
          return null;
        }
        // relay unreachable: this device's copy decides
      }
      if (p) { _accept(p); return rrStaffNow(); }
      _wrong.n++;
      if (_wrong.n >= C().wrongMax) { _wrong = { n: 0, until: Date.now() + C().wrongWaitMs }; _say(W('pinWait'), true); }
      else _say(W('pinWrong'), true);
      _entry = ''; _dots();
      return null;
    } finally { _trying = false; }
  }
  function rrStaffSwitch() {
    if (!rrStaffOn()) return;
    _who = null;
    _saveWho();
    _repaint();
    _showPin();
  }
  function rrStaffLock(msg) { _adminClose(); _who = null; _saveWho(); _repaint(); _showPin(msg); }

  // ── keeping the list fresh, and the idle lock ───────────────────────────
  var _refreshing = null;
  async function rrStaffRefresh() {
    if (!_proOn() || _offline()) return false;
    if (_refreshing) return _refreshing;
    _refreshing = (async function () {
      try {
        var r = await vaultPost({ action: 'staff_list' });
        if (!r || r.status !== 200) return false;
        _takeAnswer(r);
        _afterList();
        return true;
      } finally { _refreshing = null; }
    })();
    return _refreshing;
  }
  function _afterList() {
    if (!rrStaffOn()) { _who = null; _saveWho(); _hidePin(); _repaint(); return; }
    if (_who) {
      var p = _person(_who.id);
      if (!p || !p.on) { var nm = _who.name; rrStaffLock(W('pinGone', { name: nm })); return; }
      _who = { id: p.id, name: p.name, role: p.role };
    } else if (!_adminOpen() && !_pinEl()) _showPin();   // already asking: keep what it says
    _repaint();
  }
  function _touch() {
    var was = _lastActive;
    _lastActive = Date.now();
    if (_who && _lastActive - was > 30000) _saveWho();
  }
  function _tick() {
    if (!rrStaffOn() || !_who) return;
    if (Date.now() - _lastActive > _idleMs()) rrStaffLock(W('idleLocked'));
  }
  var _booted = false;
  function rrStaffBoot() {
    if (!_proOn()) return;
    _list = _loadList();
    if (!_booted) {
      _booted = true;
      _restoreWho();
      try {
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.addEventListener(t, _touch, { capture: true, passive: true }); });
        root.setInterval(_tick, 15000);
        root.setInterval(function () { if (!document.hidden && rrStaffOn()) rrStaffRefresh(); }, C().pollMs);   // only a business using PINs is asked every few minutes
        document.addEventListener('visibilitychange', function () { if (!document.hidden) { _tick(); rrStaffRefresh(); } });
        root.addEventListener('online', function () { rrStaffRefresh(); });
      } catch (e) {}
    }
    if (rrStaffOn() && !_who) _showPin();
    _repaint();
    rrStaffRefresh();
  }
  var _paintedWho = null;
  function _repaint() {
    try { if (typeof rrCollUiPaint === 'function') rrCollUiPaint(); } catch (e) {}
    try { if (typeof rrPrefsStaffRowRefresh === 'function') rrPrefsStaffRowRefresh(); } catch (e) {}
    // 2026-11-13: when the person working changes, what is on screen follows —
    // the greeting names them, and an open Preferences page is drawn again for
    // their role (Sue saw the Owner's "We do our own invoices" box).
    var id = _who ? _who.id : '';
    if (id === _paintedWho) return;
    _paintedWho = id;
    try { if (typeof rrPaintGreeting === 'function') rrPaintGreeting(); } catch (e) {}
    try {
      var pp = document.getElementById('page-prefs');
      if (pp && pp.classList.contains('active') && typeof buildPrefsPage === 'function') buildPrefsPage();
    } catch (e) {}
  }

  // ── the name chip in the top bar ────────────────────────────────────────
  function rrStaffChipHtml() {
    var me = rrStaffNow();
    if (!me) return '';
    return '<button type="button" id="rr-staff-chip" onclick="rrStaffSwitch()" title="' + esc(W('switchPerson')) + '" aria-label="' + esc(W('switchPerson') + ' — ' + me.name) + '"' +
      ' style="min-height:40px;padding:0.3rem 0.7rem;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer;white-space:nowrap;align-self:center;margin-left:0.4rem">' +
      '👤 ' + esc(W('chip', { name: me.name })) + '</button>';
  }

  // ── Preferences → Business tools: the Staff row (Pro only) ──────────────
  function _rowInner() {
    var on = rrStaffOn();
    return '<div class="pref-row-label"><strong>' + esc(W('prefsRow')) + '</strong><span>' + esc(on ? W('prefsHelpOn') : W('prefsHelpOff')) + '</span></div>' +
      '<button type="button" class="pref-btn" data-staff-prefs onclick="rrStaffAdminOpen()">' + esc(W('prefsOpen')) + '</button>';
  }
  function rrPrefsStaffHtml() {
    if (!_proOn()) return '';
    if (rrStaffOn() && !rrStaffCan('staff')) return '';
    return '<div class="pref-row" id="rr-staff-prefs-row">' + _rowInner() + '</div>';
  }
  function rrPrefsStaffRowRefresh() {
    var r = document.getElementById('rr-staff-prefs-row');
    if (!r) return;
    if (rrStaffOn() && !rrStaffCan('staff')) { r.remove(); return; }
    r.innerHTML = _rowInner();
  }

  // ── the Staff screen (owners and managers) ──────────────────────────────
  var _actorPin = '';          // the manager's own PIN, held only while this screen is open
  var _saving = false;
  function _adminEl() { return document.getElementById('rr-staff-admin'); }
  function _adminOpen() { return !!_adminEl(); }
  function _adminClose() { var d = _adminEl(); if (d) d.remove(); _actorPin = ''; }
  function _adminShell(inner) {
    var d = _adminEl();
    if (!d) {
      d = document.createElement('div');
      d.id = 'rr-staff-admin';
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-modal', 'true');
      d.style.cssText = 'position:fixed;inset:0;z-index:9600;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
      document.body.appendChild(d);
      if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d, _adminClose); } catch (e) {} }
    }
    d.innerHTML = '<div style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:12px;max-width:600px;width:100%;max-height:90vh;max-height:90dvh;overflow:auto;padding:1rem 1.1rem;font-family:var(--font-body);position:relative">' +
      '<button type="button" data-staff-x aria-label="' + esc(W('close')) + '" style="position:absolute;top:0.4rem;right:0.6rem;background:none;border:none;color:var(--text);font-size:1.5rem;min-width:44px;min-height:44px;cursor:pointer">&times;</button>' +
      '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.1rem 2.4rem 0.6rem 0">' + esc(W('adminTitle')) + '</div>' + inner + '</div>';
    d.querySelector('[data-staff-x]').addEventListener('click', _adminClose);
    return d;
  }
  var _INP = 'width:100%;min-height:44px;padding:0.4rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:1rem;box-sizing:border-box';
  var _BTN = 'min-height:44px;padding:0.4rem 0.9rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-weight:700;cursor:pointer';
  function _roleOptions(sel, mayAll) {
    return ['staff', 'manager', 'owner'].filter(function (r) { return mayAll || r === 'staff'; }).map(function (r) {
      return '<option value="' + r + '"' + (r === sel ? ' selected' : '') + '>' + esc(C().roleWords[r] || r) + '</option>';
    }).join('');
  }

  // Open: gated (owners and managers once PINs are in use); a connection is needed.
  function rrStaffAdminOpen() {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('staff')) return;
    if (_offline()) { toast(W('offline'), 4000, true); return; }
    if (!rrStaffOn()) return _adminFirst();
    if (!_actorPin) return _adminConfirm();
    return _adminList();
  }
  function _adminFirst() {
    var u = st().user || {};
    _adminShell('<p style="margin:0 0 0.8rem;line-height:1.45">' + esc(W('firstHelp')) + '</p>' +
      '<label for="rr-staff-f-name" style="display:block;font-size:0.85rem;margin-bottom:0.25rem">' + esc(W('name')) + '</label>' +
      '<input id="rr-staff-f-name" maxlength="40" value="' + esc(u.name || '') + '" style="' + _INP + '">' +
      '<label for="rr-staff-f-pin" style="display:block;font-size:0.85rem;margin:0.7rem 0 0.25rem">' + esc(W('pin')) + '</label>' +
      '<div style="display:flex;gap:0.5rem"><input id="rr-staff-f-pin" inputmode="numeric" autocomplete="off" maxlength="' + C().pinMax + '" style="' + _INP + '">' +
      '<button type="button" data-staff-make="rr-staff-f-pin" style="' + _BTN + ';white-space:nowrap">' + esc(W('makeOne')) + '</button></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:1rem"><button type="button" id="rr-staff-f-go" style="' + _BTN + ';background:var(--accent);color:var(--on-accent);border:none">' + esc(W('firstGo')) + '</button></div>');
    _wireMake();
    var fgo = document.getElementById('rr-staff-f-go');
    fgo.addEventListener('click', function () {
      var name = document.getElementById('rr-staff-f-name').value, pin = document.getElementById('rr-staff-f-pin').value.trim();
      _send({ action: 'staff_save', person: { name: name, role: 'owner', pin: pin } }, function (r) {
        var me = (r.people || [])[0];
        if (me) { _actorPin = pin; _accept({ id: me.id, name: me.name, role: me.role }); }
        toast(W('saved'), 2500);
        _adminList();
      }, fgo);
    });
  }
  function _adminConfirm() {
    _adminShell('<p style="margin:0 0 0.6rem">' + esc(W('confirmHelp')) + '</p>' +
      '<input id="rr-staff-c-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="' + C().pinMax + '" aria-label="' + esc(W('confirmTitle')) + '" style="' + _INP + '">' +
      '<div style="display:flex;justify-content:flex-end;margin-top:0.8rem"><button type="button" id="rr-staff-c-go" style="' + _BTN + '">' + esc(W('enter')) + '</button></div>');
    var go = function () {
      var me = rrStaffNow(); if (!me) return _adminClose();
      var pin = document.getElementById('rr-staff-c-pin').value.trim();
      _send({ action: 'staff_check', actorId: me.id, actorPin: pin }, function () { _actorPin = pin; _adminList(); }, document.getElementById('rr-staff-c-go'));
    };
    document.getElementById('rr-staff-c-go').addEventListener('click', go);
    document.getElementById('rr-staff-c-pin').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    try { document.getElementById('rr-staff-c-pin').focus(); } catch (e) {}
  }
  function _adminList() {
    var me = rrStaffNow(); if (!me) return _adminClose();
    var owner = me.role === 'owner';
    var rows = (_list ? _list.people : []).map(function (p) {
      var mine = owner || p.role === 'staff';
      return '<div data-staff-person="' + esc(p.id) + '" style="border:1px solid var(--border);border-radius:10px;padding:0.6rem;margin-bottom:0.5rem;' + (p.on ? '' : 'opacity:0.7') + '">' +
        '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">' +
          '<strong style="flex:1;min-width:8rem">' + esc(p.name) + (p.id === me.id ? ' (' + esc(W('you')) + ')' : '') + '</strong>' +
          '<span style="color:var(--text-dim);font-size:0.9rem">' + esc(C().roleWords[p.role] || p.role) + '</span>' +
          (mine ? '<button type="button" data-staff-switch="' + esc(p.id) + '" data-on="' + (p.on ? '1' : '0') + '" aria-pressed="' + (p.on ? 'true' : 'false') + '" style="' + _BTN + ';min-width:4.5rem;' + (p.on ? 'background:var(--accent);color:var(--on-accent);border:none' : '') + '">' + esc(p.on ? W('on') : W('off')) + '</button>'
                : '<span style="font-weight:700">' + esc(p.on ? W('on') : W('off')) + '</span>') +
        '</div>' +
        (mine ? '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:0.4rem;margin-top:0.5rem">' +
          '<input data-staff-name="' + esc(p.id) + '" maxlength="40" value="' + esc(p.name) + '" aria-label="' + esc(W('name')) + '" style="' + _INP + '">' +
          '<select data-staff-role="' + esc(p.id) + '" aria-label="' + esc(W('role')) + '" style="' + _INP + '"' + (owner ? '' : ' disabled') + '>' + _roleOptions(p.role, owner) + '</select>' +
          '<button type="button" data-staff-save="' + esc(p.id) + '" style="' + _BTN + '">' + esc(W('save')) + '</button>' +
          '<input data-staff-pin="' + esc(p.id) + '" inputmode="numeric" autocomplete="off" maxlength="' + C().pinMax + '" placeholder="' + esc(W('newPin')) + '" aria-label="' + esc(W('newPin')) + '" style="' + _INP + '">' +
          '<button type="button" data-staff-make="' + 'rr-staff-pin-' + esc(p.id) + '" style="' + _BTN + '">' + esc(W('makeOne')) + '</button>' +
          '<span></span>' +
        '</div>' : '') +
      '</div>';
    }).join('');
    var add = '<div style="border-top:1px solid var(--border);margin-top:0.8rem;padding-top:0.8rem">' +
      '<div style="font-weight:700;margin-bottom:0.4rem">' + esc(W('add')) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">' +
        '<input id="rr-staff-a-name" maxlength="40" placeholder="' + esc(W('name')) + '" aria-label="' + esc(W('name')) + '" style="' + _INP + '">' +
        '<select id="rr-staff-a-role" aria-label="' + esc(W('role')) + '" style="' + _INP + '">' + _roleOptions('staff', owner) + '</select>' +
        '<input id="rr-staff-a-pin" inputmode="numeric" autocomplete="off" maxlength="' + C().pinMax + '" placeholder="' + esc(W('pin')) + '" aria-label="' + esc(W('pin')) + '" style="' + _INP + '">' +
        '<button type="button" data-staff-make="rr-staff-a-pin" style="' + _BTN + '">' + esc(W('makeOne')) + '</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:0.6rem"><button type="button" id="rr-staff-a-go" style="' + _BTN + ';background:var(--accent);color:var(--on-accent);border:none">' + esc(W('add')) + '</button></div></div>';
    var idle = owner ? '<div style="border-top:1px solid var(--border);margin-top:0.8rem;padding-top:0.8rem">' +
      '<label for="rr-staff-idle" style="display:block;font-size:0.9rem;margin-bottom:0.3rem">' + esc(W('idle')) + '</label>' +
      '<div style="display:flex;gap:0.5rem"><input id="rr-staff-idle" type="number" min="1" max="240" value="' + esc(_list ? _list.idleMin : 10) + '" style="' + _INP + ';max-width:8rem">' +
      '<button type="button" id="rr-staff-idle-go" style="' + _BTN + '">' + esc(W('idleSave')) + '</button></div></div>' : '';
    var d = _adminShell(rows + add + idle);
    // the per-person PIN boxes get ids so "make one up" can fill them
    d.querySelectorAll('[data-staff-pin]').forEach(function (el) { el.id = 'rr-staff-pin-' + el.getAttribute('data-staff-pin'); });
    _wireMake();
    d.querySelectorAll('[data-staff-switch]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-staff-switch'), on = b.getAttribute('data-on') !== '1', p = _person(id);
        _send({ action: 'staff_switch', actorId: me.id, actorPin: _actorPin, id: id, on: on }, function () {
          toast(W(on ? 'turnedOn' : 'turnedOff', { name: p ? p.name : '' }), 3000);
          _adminList();
        }, b);
      });
    });
    d.querySelectorAll('[data-staff-save]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-staff-save');
        var person = { id: id, name: d.querySelector('[data-staff-name="' + id + '"]').value };
        var roleEl = d.querySelector('[data-staff-role="' + id + '"]');
        if (owner && roleEl) person.role = roleEl.value;
        var pin = d.querySelector('[data-staff-pin="' + id + '"]').value.trim();
        if (pin) person.pin = pin;
        _send({ action: 'staff_save', actorId: me.id, actorPin: _actorPin, person: person }, function () {
          if (pin && id === me.id) _actorPin = pin;
          toast(pin ? W('pinChanged', { name: person.name, pin: pin }) : W('saved'), pin ? 12000 : 2500);
          _adminList();
        }, b);
      });
    });
    var ago = document.getElementById('rr-staff-a-go');
    ago.addEventListener('click', function () {
      var person = { name: document.getElementById('rr-staff-a-name').value, role: document.getElementById('rr-staff-a-role').value,
                     pin: document.getElementById('rr-staff-a-pin').value.trim() };
      _send({ action: 'staff_save', actorId: me.id, actorPin: _actorPin, person: person }, function () {
        toast(W('added', { name: person.name, pin: person.pin }), 12000);
        _adminList();
      }, ago);
    });
    var ig = document.getElementById('rr-staff-idle-go');
    if (ig) ig.addEventListener('click', function () {
      _send({ action: 'staff_settings', actorId: me.id, actorPin: _actorPin, idleMin: Number(document.getElementById('rr-staff-idle').value) }, function () { toast(W('saved'), 2500); _adminList(); }, ig);
    });
  }
  function _wireMake() {
    var d = _adminEl(); if (!d) return;
    d.querySelectorAll('[data-staff-make]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var el = document.getElementById(b.getAttribute('data-staff-make'));
        if (el) el.value = await rrStaffMakePin();
      });
    });
  }
  // Every Staff-screen change goes to the relay; its answer is the new list.
  // One at a time (a double tap never sends twice).
  // A button that started the call shows it is working until the answer comes
  // (2026-11-13: "Make me the Owner" looked dead for ten seconds and was pressed again).
  function _busy(btn, on) {
    if (!btn) return;
    try {
      if (on) { btn.setAttribute('data-staff-label', btn.textContent); btn.textContent = W('working'); btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
      else if (btn.isConnected) { btn.textContent = btn.getAttribute('data-staff-label') || btn.textContent; btn.disabled = false; btn.removeAttribute('aria-busy'); }
    } catch (e) {}
  }
  async function _send(body, onOk, btn) {
    if (_saving) return;
    if (_offline()) { toast(W('offline'), 4000, true); return; }
    if (body.person && body.person.pin) {
      var prob = rrStaffPinProblem(body.person.pin);
      if (prob) { toast(errWord(prob), 4000, true); return; }
    }
    _saving = true;
    _busy(btn, true);
    try {
      var r = await _post(body);
      if (!r) { toast(W('failed'), 4000, true); return; }
      if (r.status !== 200) {
        if (r.message === 'wrong_pin' && body.action !== 'staff_check') _actorPin = '';
        toast(errWord(r.message), 4500, true);
        if (r.message === 'wrong_pin' && body.action === 'staff_check') return;
        if (r.message === 'wrong_pin') return _adminConfirm();
        return;
      }
      if (r.people) { _takeAnswer(r); _afterListQuiet(); }
      onOk(r);
    } finally { _saving = false; _busy(btn, false); }
  }
  // ── an Owner forgot their PIN (relay v5.5) ───────────────────────────────
  // A one-time code goes to the business account's own email address; with it,
  // a new PIN is set for an Owner. Online only. A shop is never locked out.
  function _resetEl() { return document.getElementById('rr-staff-reset'); }
  function _resetClose() { var d = _resetEl(); if (d) d.remove(); }
  function _resetShell(inner) {
    var d = _resetEl();
    if (!d) {
      d = document.createElement('div');
      d.id = 'rr-staff-reset';
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-modal', 'true');
      d.style.cssText = 'position:fixed;inset:0;z-index:9900;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
      document.body.appendChild(d);
      if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d, _resetClose); } catch (e) {} }
    }
    d.innerHTML = '<div style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:12px;max-width:440px;width:100%;max-height:90vh;max-height:90dvh;overflow:auto;padding:1rem 1.1rem;font-family:var(--font-body);position:relative">' +
      '<button type="button" data-reset-x aria-label="' + esc(W('close')) + '" style="position:absolute;top:0.4rem;right:0.6rem;background:none;border:none;color:var(--text);font-size:1.5rem;min-width:44px;min-height:44px;cursor:pointer">&times;</button>' +
      '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.1rem 2.4rem 0.6rem 0">' + esc(W('forgotTitle')) + '</div>' + inner + '</div>';
    d.querySelector('[data-reset-x]').addEventListener('click', _resetClose);
    return d;
  }
  function _resetOpen() {
    if (_offline()) { toast(W('forgotOffline'), 4500, true); return; }
    var d = _resetShell('<p style="margin:0 0 0.9rem;line-height:1.45">' + esc(W('forgotHelp')) + '</p>' +
      '<div style="display:flex;justify-content:flex-end"><button type="button" id="rr-staff-r-send" style="' + _BTN + ';background:var(--accent);color:var(--on-accent);border:none">' + esc(W('forgotSend')) + '</button></div>');
    var send = d.querySelector('#rr-staff-r-send');
    send.addEventListener('click', function () {
      _send({ action: 'staff_reset_code' }, function (r) { _resetStep2(r.to || ''); }, send);
    });
  }
  function _resetStep2(to) {
    var owners = (_list ? _list.people : []).filter(function (p) { return p.role === 'owner'; });
    var pick = owners.length > 1
      ? '<label for="rr-staff-r-who" style="display:block;font-size:0.85rem;margin-bottom:0.25rem">' + esc(W('forgotWho')) + '</label>' +
        '<select id="rr-staff-r-who" style="' + _INP + '">' + owners.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select>'
      : '<input type="hidden" id="rr-staff-r-who" value="' + esc(owners[0] ? owners[0].id : '') + '"><div style="font-weight:700;margin-bottom:0.2rem">' + esc(W('forgotFor', { name: owners[0] ? owners[0].name : '' })) + '</div>';
    var d = _resetShell('<p style="margin:0 0 0.8rem;line-height:1.45">' + esc(W('forgotSent', { to: to })) + '</p>' + pick +
      '<label for="rr-staff-r-code" style="display:block;font-size:0.85rem;margin:0.7rem 0 0.25rem">' + esc(W('forgotCode')) + '</label>' +
      '<input id="rr-staff-r-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="' + _INP + '">' +
      '<label for="rr-staff-r-pin" style="display:block;font-size:0.85rem;margin:0.7rem 0 0.25rem">' + esc(W('forgotNewPin')) + '</label>' +
      '<div style="display:flex;gap:0.5rem"><input id="rr-staff-r-pin" inputmode="numeric" autocomplete="off" maxlength="' + C().pinMax + '" style="' + _INP + '">' +
      '<button type="button" id="rr-staff-r-make" style="' + _BTN + ';white-space:nowrap">' + esc(W('makeOne')) + '</button></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:1rem"><button type="button" id="rr-staff-r-go" style="' + _BTN + ';background:var(--accent);color:var(--on-accent);border:none">' + esc(W('forgotGo')) + '</button></div>');
    d.querySelector('#rr-staff-r-make').addEventListener('click', async function () { d.querySelector('#rr-staff-r-pin').value = await rrStaffMakePin(); });
    var go = d.querySelector('#rr-staff-r-go');
    go.addEventListener('click', function () {
      var id = d.querySelector('#rr-staff-r-who').value, pin = d.querySelector('#rr-staff-r-pin').value.trim(), code = d.querySelector('#rr-staff-r-code').value.trim();
      _send({ action: 'staff_reset_pin', code: code, id: id, person: { pin: pin }, pin: pin }, function (r) {
        _resetClose();
        _accept({ id: String(r.id || id), name: String(r.name || ''), role: String(r.role || 'owner') });
        toast(W('forgotDone', { name: r.name || '', pin: pin }), 12000);
      }, go);
    });
    try { d.querySelector('#rr-staff-r-code').focus(); } catch (e) {}
  }

  // A gated action refused by the roles door: the door has already told the
  // person who to ask, so the caller must not cover it with "try again".
  function rrStaffRefused(r) { return !!(r && r.why === 'role'); }

  // the relay calls, each written out (tests/relay_proof_tests.js reads them)
  function _post(body) {
    if (body.action === 'staff_save') return vaultPost({ action: 'staff_save', actorId: body.actorId, actorPin: body.actorPin, person: body.person });
    if (body.action === 'staff_switch') return vaultPost({ action: 'staff_switch', actorId: body.actorId, actorPin: body.actorPin, id: body.id, on: body.on });
    if (body.action === 'staff_settings') return vaultPost({ action: 'staff_settings', actorId: body.actorId, actorPin: body.actorPin, idleMin: body.idleMin });
    if (body.action === 'staff_check') return vaultPost({ action: 'staff_check', actorId: body.actorId, actorPin: body.actorPin });
    if (body.action === 'staff_who') return vaultPost({ action: 'staff_who', pin: body.pin });                                        // relay v5.5
    if (body.action === 'staff_reset_code') return vaultPost({ action: 'staff_reset_code' });                                        // relay v5.5
    if (body.action === 'staff_reset_pin') return vaultPost({ action: 'staff_reset_pin', code: body.code, id: body.id, pin: body.pin });   // relay v5.5
    return Promise.resolve(null);
  }
  // After a change made on THIS screen: someone turned off here who is the
  // person working is locked out at once; otherwise names / roles refresh.
  function _afterListQuiet() {
    if (_who) {
      var p = _person(_who.id);
      if (!p || !p.on) { _adminClose(); rrStaffLock(W('pinGone', { name: _who.name })); return; }
      _who = { id: p.id, name: p.name, role: p.role };
      _saveWho();
    }
    _repaint();
  }

  root.rrStaffOn = rrStaffOn;
  root.rrStaffNow = rrStaffNow;
  root.rrStaffCan = rrStaffCan;
  root.rrStaffGate = rrStaffGate;
  root.rrWhoNow = rrWhoNow;
  root.rrStaffBoot = rrStaffBoot;
  root.rrStaffRefresh = rrStaffRefresh;
  root.rrStaffTryPin = rrStaffTryPin;
  root.rrStaffSwitch = rrStaffSwitch;
  root.rrStaffLock = rrStaffLock;
  root.rrStaffChipHtml = rrStaffChipHtml;
  root.rrStaffPinProblem = rrStaffPinProblem;
  root.rrStaffMakePin = rrStaffMakePin;
  root.rrPrefsStaffHtml = rrPrefsStaffHtml;
  root.rrPrefsStaffRowRefresh = rrPrefsStaffRowRefresh;
  root.rrStaffAdminOpen = rrStaffAdminOpen;
  root.rrStaffRefused = rrStaffRefused;
  root._rrStaffState = function () { return { list: _list, who: _who, lastActive: _lastActive, wrong: _wrong }; };   // tests only
  root._rrStaffAge = function (ms) { _lastActive -= ms; };                                                             // tests only: time passes
})(typeof window !== 'undefined' ? window : this);
