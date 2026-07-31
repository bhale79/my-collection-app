// ═══════════════════════════════════════════════════════════════
// look-sync.js — your look follows you to the phone (v0.9.1230)
//
// Brad: "lets get this on the phone app or whatever was the part we need to
// complete it."
//
// Everything the Appearance editor makes — the colours, the saved looks, the
// three marks and the header line — has lived in this browser's own storage,
// which means it lived on ONE machine. This carries it.
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
//     it does not get to slow down opening the app.
//
//  4. IT NEVER OVERWRITES SOMETHING NEWER. Each side stamps when it last
//     changed. A device only takes what is newer than its own, so editing on
//     the desktop while the phone sits idle cannot lose the desktop's work.
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

  // The keys that make up "your look". Named here rather than reached for,
  // so adding one to the editor is a deliberate act of adding it here too.
  var LOOK_KEYS = [
    'lv_theme',            // which theme is chosen
    'lv_skin_custom',      // the eleven colours plus the derived shades
    'rr_skin_presets',     // saved looks
    'rr_skin_brand',       // watermark, sidebar and header marks + the line
    'rr_logo_cards'        // the dashboard card library
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
  // Called whenever the editor commits something. The stamp is what lets two
  // devices tell whose copy is newer without asking a server.
  function rrLookTouch() {
    _set(STAMP_KEY, String(Date.now()));
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
  function _ready() {
    return typeof driveRequest === 'function' &&
           typeof window.driveCache !== 'undefined' &&
           !!(window.driveCache && window.driveCache.vaultId);
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
  async function rrLookPush(opts) {
    opts = opts || {};
    if (!_ready()) return { ok: false, why: 'drive' };
    try {
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
    }
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
        if (opts.loud && typeof showToast === 'function') showToast('No look saved to Drive yet — press Apply in Appearance to put one there', 4200);
        return { ok: false, why: 'none' };
      }
      var seen = _json(SEEN_KEY, {});
      if (!opts.force && seen.modifiedTime && seen.modifiedTime === file.modifiedTime) {
        return { ok: true, changed: false };
      }
      var snap = await _download(file.id);
      if (!snap || !snap.keys) return { ok: false, why: 'empty' };

      // Never take something older than this device's own work.
      var mine = parseInt(_get(STAMP_KEY) || '0', 10) || 0;
      if (!opts.force && mine && (snap.stamp || 0) < mine) {
        _set(SEEN_KEY, JSON.stringify({ fileId: file.id, modifiedTime: file.modifiedTime, localStamp: mine }));
        return { ok: true, changed: false, why: 'mine-is-newer' };
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
  // not get to slow down opening the app.
  var _checked = false;
  function rrLookCheckLater(delayMs) {
    if (_checked) return;
    _checked = true;
    setTimeout(function () {
      if (!_ready()) return;
      rrLookPull({ loud: false });
    }, typeof delayMs === 'number' ? delayMs : 4000);
  }

  window.rrLookSnapshot = rrLookSnapshot;
  window.rrLookTouch = rrLookTouch;
  window.rrLookPush = rrLookPush;
  window.rrLookPull = rrLookPull;
  window.rrLookCheckLater = rrLookCheckLater;
  window.RR_LOOK_KEYS = LOOK_KEYS;
})();
