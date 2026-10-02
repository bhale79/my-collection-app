// ═══════════════════════════════════════════════════════════════
// look-sync.js — your look follows you to the phone (v0.9.1230)
//
// Brad: "lets get this on the phone app or whatever was the part we need to
// complete it."
//
// ══ v0.9.1867 — IT HAD NEVER WORKED, AND MOST OF IT MOVED OUT ══════════
// Brad, 2026-10-02, after his gold became orange on the desktop: would it
// reach the phone? No. From the day this file shipped, _ready() looked for
// `window.driveCache` — and driveCache is a `const` in drive.js, which never
// lands on window ([[feedback_let_not_on_window]]). Never ready, so never a
// push and never a pull: no look file was ever written, and every "it travels
// by look-sync" claim since (v1230 colours, v1585 custom columns, v1814
// switches, v1862/v1864 layouts) was false. No test ever ran a push.
//
// The fix is in two halves, because the two halves want different rules:
//
//  • THE SMALL SETTINGS LEFT THIS FILE. The colours and theme choice, the
//    saved looks, the custom column names and switches, the column layouts
//    and the auto-offer roster are ACCOUNT settings now: written through
//    _prefSet, read through _prefGet, carried by the account prefs file
//    (drive.js, v1779) newest-PER-SETTING. This file's rule was newest-
//    device-wins for the WHOLE snapshot — so re-ordering a column on the
//    phone would have dragged the desktop's colours back with it. One proven
//    route, and the overwrite risk is gone.
//
//  • THE BIG PICTURES STAY HERE: the three brand marks + header line
//    (rr_skin_brand) and the dashboard card library (rr_logo_cards) — images
//    as data URLs, far too big to ride a file that is re-read on every start.
//    For these the whole-snapshot rule is right: they are only ever written
//    by a deliberate Apply, all together.
//
// FOUR DECISIONS WORTH KNOWING, BECAUSE EACH ONE RULES SOMETHING OUT:
//
//  1. ONE FILE, IN THE APP'S OWN DRIVE FOLDER — not the photo folder. Brad's
//     first instinct was the photo folder, and the risk flagged at the time
//     was real: that folder is walked by the thumbnail code and the photo
//     inbox, and a logo sitting among the item photos is a logo waiting to be
//     mistaken for one. A settings file in the vault cannot be.
//
//  2. IT ASKS BEFORE IT DOWNLOADS. On start-up it reads one field —
//     modifiedTime — and only pulls the file if that is newer than what this
//     device already saw. A look with three marks in it is not small, and
//     nobody should pay for it on a phone signal to be told nothing changed.
//
//  3. IT RUNS AFTER THE APP IS USABLE, never before. Sync is a convenience;
//     it does not get to slow down opening the app. (v1867: it waits for
//     Drive to be ready rather than giving up if it is not ready yet.)
//
//  4. IT NEVER OVERWRITES SOMETHING NEWER. Each side stamps when it last
//     changed. A device only takes what is newer than its own — and (v1867)
//     when its own is newer, it SENDS it, so the file is always the newest
//     device's. Every change is sent: rrLookTouch schedules a push itself,
//     where it used to only stamp and wait for an Appearance → Apply.
//
// Everything here fails quietly. Not signed in, no Drive, no signal, no file
// — the app carries on wearing whatever this device already has. A look is
// not worth an error message on start-up.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var FILE_NAME = 'The Rail Roster - look.json';
  var SEEN_KEY = 'rr_look_synced';     // {fileId, modifiedTime, localStamp}
  var STAMP_KEY = 'rr_look_stamp';     // when THIS device last changed its look

  // The keys that make up "your look" HERE — the big pictures only (see the
  // header). Everything small is an account setting written through _prefSet;
  // a key still sitting in an old look file that is not named here is ignored.
  var LOOK_KEYS = [
    'rr_skin_brand',       // watermark, sidebar and header marks + the line
    'rr_logo_cards'        // the dashboard card library
  ];
  // v0.9.1867: the keys that LEFT this file for the account prefs. Named so
  // the tests can hold the line (never written raw, never in LOOK_KEYS again).
  var MOVED_TO_PREFS = [
    'lv_theme', 'lv_skin_custom', 'rr_skin_presets',
    'lv_label_custom1', 'lv_label_custom2', 'lv_label_custom3', 'lv_label_custom4', 'lv_label_custom5',
    'lv_custom1_enabled', 'lv_custom2_enabled', 'lv_custom3_enabled', 'lv_custom4_enabled', 'lv_custom5_enabled',
    'lv_shipper_enabled', 'lv_subcoll_enabled',
    'lv_coll_columns_v1', 'lv_fs_columns_v1', 'lv_coll_columns_seen_v1'
  ];

  function _get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function _set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function _json(k, d) { try { return JSON.parse(_get(k) || 'null') || d; } catch (e) { return d; } }

  // ── what this device is wearing ──────────────────────────────────
  function rrLookSnapshot() {
    var out = { v: 1, stamp: parseInt(_get(STAMP_KEY) || '0', 10) || 0, keys: {} };
    LOOK_KEYS.forEach(function (k) {
      var v = _get(k);
      if (v != null) out.keys[k] = v;
    });
    return out;
  }
  // Called whenever something in LOOK_KEYS is written. The stamp is what lets
  // two devices tell whose copy is newer without asking a server — and (v1867)
  // the push is scheduled right here, debounced like the account prefs'
  // (rrPrefsQueuePush), so a change is SENT, not just dated. A direct
  // rrLookPush (Appearance → Apply) cancels the scheduled one.
  var _touchTimer = null;
  function rrLookTouch() {
    _set(STAMP_KEY, String(Date.now()));
    if (_touchTimer) clearTimeout(_touchTimer);
    _touchTimer = setTimeout(function () { _touchTimer = null; rrLookPush({ loud: false }); }, 1500);
  }

  function _applySnapshot(snap) {
    if (!snap || !snap.keys) return false;
    LOOK_KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(snap.keys, k)) _set(k, snap.keys[k]);
    });
    _set(STAMP_KEY, String(snap.stamp || Date.now()));
    // Repaint from what just landed. Both are no-ops if the app has not
    // finished building its shell yet.
    try { if (typeof applyTheme === 'function') applyTheme(); } catch (e) {}
    try { if (typeof window.applyBranding === 'function') window.applyBranding(); } catch (e) {}
    return true;
  }

  // ── Drive ────────────────────────────────────────────────────────
  // driveCache is a top-level `const` in drive.js: visible here by its bare
  // name, NEVER as window.driveCache. (That one word kept this file asleep
  // from v1230 to v1866 — [[feedback_let_not_on_window]].)
  function _ready() {
    return typeof driveRequest === 'function' &&
           typeof driveCache !== 'undefined' &&
           !!(driveCache && driveCache.vaultId);
  }

  async function _find() {
    var q = "name='" + FILE_NAME + "' and '" + driveCache.vaultId +
            "' in parents and trashed=false";
    var res = await driveRequest('GET',
      '/files?q=' + encodeURIComponent(q) + '&fields=files(id,modifiedTime)&pageSize=1');
    return (res && res.files && res.files[0]) || null;
  }

  async function _download(fileId) {
    var res = await driveRequest('GET', '/files/' + fileId + '?alt=media');
    return res;
  }

  // driveUploadFile creates; an existing file has to be PATCHed or every save
  // leaves another copy behind.
  async function _write(fileId, snap) {
    var body = new Blob([JSON.stringify(snap)], { type: 'application/json' });
    var token = _get('lv_token');
    if (!token) throw new Error('Not signed in');
    var url, method;
    if (fileId) {
      url = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId
          + '?uploadType=media&fields=id,modifiedTime';
      method = 'PATCH';
      var r1 = await fetch(url, {
        method: method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: body
      });
      if (!r1.ok) throw new Error('HTTP ' + r1.status);
      return r1.json();
    }
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: FILE_NAME, parents: [driveCache.vaultId], mimeType: 'application/json'
    })], { type: 'application/json' }));
    form.append('file', body);
    var r2 = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form
    });
    if (!r2.ok) throw new Error('HTTP ' + r2.status);
    return r2.json();
  }

  // ── push ─────────────────────────────────────────────────────────
  var _pushInflight = null;
  async function rrLookPush(opts) {
    opts = opts || {};
    if (!_ready()) return { ok: false, why: 'drive' };
    // v0.9.1286 (audit round 3, R3-2): same race class as the folder fix —
    // two rapid pushes with no fileId cached both _find() nothing and both
    // POST, leaving two look files whose later reads pick one at random.
    // One push at a time; a second Apply rides the first's promise.
    if (_pushInflight) return _pushInflight;
    if (_touchTimer) { clearTimeout(_touchTimer); _touchTimer = null; }   // this push covers the scheduled one
    _pushInflight = (async () => { try {
      var seen = _json(SEEN_KEY, {});
      var file = seen.fileId ? { id: seen.fileId } : await _find();
      var snap = rrLookSnapshot();
      var saved = await _write(file && file.id, snap);
      _set(SEEN_KEY, JSON.stringify({
        fileId: (saved && saved.id) || (file && file.id) || '',
        modifiedTime: (saved && saved.modifiedTime) || '',
        localStamp: snap.stamp
      }));
      if (opts.loud && typeof showToast === 'function') showToast('Your look is saved to Drive — it will follow you to your other devices', 4000);
      return { ok: true };
    } catch (e) {
      console.warn('[look-sync push]', e);
      if (opts.loud && typeof showToast === 'function') showToast('Could not save your look to Drive — it is still saved on this device', 4000, true);
      return { ok: false, why: String(e && e.message) };
    } finally { _pushInflight = null; } })();
    return _pushInflight;
  }

  // ── pull ─────────────────────────────────────────────────────────
  // Reads ONE field first. Downloading a look to be told it has not changed
  // is exactly the cost this is written to avoid.
  async function rrLookPull(opts) {
    opts = opts || {};
    if (!_ready()) return { ok: false, why: 'drive' };
    try {
      var file = await _find();
      if (!file) {
        // v0.9.1867: no file yet, but this device wears something — seed the
        // account with it rather than waiting for the next Apply.
        var mineSnap = rrLookSnapshot();
        if (mineSnap.stamp && Object.keys(mineSnap.keys).length) {
          var seeded = await rrLookPush({ loud: false });
          return { ok: !!(seeded && seeded.ok), why: 'seeded' };
        }
        if (opts.loud && typeof showToast === 'function') showToast('No look saved to Drive yet — press Apply in Appearance to put one there', 4200);
        return { ok: false, why: 'none' };
      }
      var seen = _json(SEEN_KEY, {});
      if (!opts.force && seen.modifiedTime && seen.modifiedTime === file.modifiedTime) {
        return { ok: true, changed: false };
      }
      var snap = await _download(file.id);
      if (!snap || !snap.keys) return { ok: false, why: 'empty' };

      // Never take something older than this device's own work — and (v1867)
      // when this device's is newer, send it: the file is the newest device's.
      var mine = parseInt(_get(STAMP_KEY) || '0', 10) || 0;
      if (!opts.force && mine && (snap.stamp || 0) < mine) {
        _set(SEEN_KEY, JSON.stringify({ fileId: file.id, modifiedTime: file.modifiedTime, localStamp: mine }));
        var sent = await rrLookPush({ loud: false });
        return { ok: true, changed: false, why: 'mine-is-newer', pushed: !!(sent && sent.ok) };
      }

      _applySnapshot(snap);
      _set(SEEN_KEY, JSON.stringify({
        fileId: file.id, modifiedTime: file.modifiedTime, localStamp: snap.stamp || 0
      }));
      if (typeof showToast === 'function') showToast('Your look has been brought over from your other device', 4000);
      return { ok: true, changed: true };
    } catch (e) {
      console.warn('[look-sync pull]', e);
      if (opts.loud && typeof showToast === 'function') showToast('Could not reach Drive — this device is still wearing its own look', 4000, true);
      return { ok: false, why: String(e && e.message) };
    }
  }

  // ── the quiet check after start-up ───────────────────────────────
  // Deliberately late and deliberately once. Sync is a convenience and does
  // not get to slow down opening the app. v0.9.1867: Drive's folder ids
  // arrive on their own schedule, so "not ready yet" means wait and look
  // again (every 2 s, for a minute), not give up for the session.
  var _checked = false;
  function rrLookCheckLater(delayMs, everyMs, tries) {
    if (_checked) return;
    _checked = true;
    var left = (typeof tries === 'number') ? tries : 30;
    var again = (typeof everyMs === 'number') ? everyMs : 2000;
    var tick = function () {
      if (_ready()) { rrLookPull({ loud: false }); return; }
      if (--left > 0) setTimeout(tick, again);
    };
    setTimeout(tick, typeof delayMs === 'number' ? delayMs : 4000);
  }

  window.rrLookSnapshot = rrLookSnapshot;
  window.rrLookTouch = rrLookTouch;
  window.rrLookPush = rrLookPush;
  window.rrLookPull = rrLookPull;
  window.rrLookCheckLater = rrLookCheckLater;
  window.RR_LOOK_KEYS = LOOK_KEYS;
  window.RR_LOOK_MOVED_TO_PREFS = MOVED_TO_PREFS;
})();
