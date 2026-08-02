// ═══════════════════════════════════════════════════════════════
// write-outbox.js — no write to your collection disappears quietly
//                   (v0.9.1246)
//
// THE PROBLEM THIS EXISTS FOR:
//
// The app writes to the user's Google Sheet from 193 places. Seventy of them
// sit behind a catch that swallows the error — `catch (e) {}` or a
// console.warn nobody will ever read. When one of those writes fails (an
// expired token, a dropped signal at a train show, a rate limit), the app
// carries on exactly as if it had saved. The user finds out later, or never.
//
// That is the same family as the row-number bug: not a crash, not a wrong
// answer on screen — a quiet loss you cannot see. It is the last structural
// thing standing between this app and being trustworthy on a bad connection,
// which is precisely the condition a collector at a show is in.
//
// WHAT THIS DOES, AND DELIBERATELY DOES NOT DO:
//
// It does NOT wrap 70 call sites. Every one of them goes through
// sheetsUpdate / sheetsAppend / sheetsDeleteRow, so those three record the
// failure and then rethrow UNCHANGED. Nothing downstream behaves differently
// — the swallowing catches still swallow the exception, they just no longer
// swallow the FACT.
//
// ── The rule that shapes everything below ──────────────────────────────
//
// A SHEET RANGE IS A POSITION, NOT AN IDENTITY. `Collection!A57:V57` means
// "row 57", and row 57 is a different item after anything above it is
// deleted. So a failed write is only safe to replay while we still know
// nothing has moved:
//
//   • SAME SESSION, and no row deletion since it was queued → safe to retry
//     automatically. Nothing has shifted under it.
//   • AFTER A RELOAD, or after any delete → NOT replayed automatically, ever.
//     The app shows the user what did not save and lets them decide. Replaying
//     a stale range would write the right data onto the wrong item, which is
//     worse than losing it.
//   • A DELETE IS NEVER REPLAYED. Not once, not ever, not with permission
//     from this code. It is recorded so it can be shown, and that is all.
//     Re-running a delete against shifted rows destroys a different item.
//
// That is why this is an outbox with a conscience rather than a queue.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var KEY = 'rr_write_outbox';
  var MAX = 200;                 // a cap, so a bad night cannot fill storage
  var _sessionId = null;         // set once per load; identifies "this session"
  var _rowsMovedAt = 0;          // when a delete last shifted row numbers
  var _retrying = false;
  var _timer = null;

  function _now() { return Date.now(); }

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function _save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch (e) {}
  }

  function _session() {
    if (!_sessionId) {
      // Not Date.now() alone — two loads in the same millisecond would look
      // like one session and a stale entry could be auto-replayed.
      _sessionId = String(_now()) + '.' + Math.random().toString(36).slice(2, 8);
    }
    return _sessionId;
  }

  // ── recording ────────────────────────────────────────────────────
  // kind: 'update' | 'append' | 'delete'
  function rrOutboxRecord(kind, args, err) {
    try {
      var why = String((err && err.message) || err || '');
      // A blocked write is not a failed one. The trial gate said no on
      // purpose; queueing it would save something the app refused to save.
      if (why === 'readonly') return null;
      var list = _load();
      var entry = {
        id: String(_now()) + '.' + Math.random().toString(36).slice(2, 6),
        kind: kind,
        args: args,
        why: why,
        at: _now(),
        session: _session(),
        // Recorded at queue time, so a later delete can invalidate it.
        movedAt: _rowsMovedAt,
        tries: 0
      };
      list.push(entry);
      _save(list);
      _paint();
      return entry.id;
    } catch (e) { return null; }
  }

  // Called when a row is deleted: every queued range write is now suspect,
  // because the row it names may no longer be the row it meant.
  function rrOutboxRowsMoved() {
    _rowsMovedAt = _now();
  }

  function rrOutboxList() { return _load(); }
  function rrOutboxCount() { return _load().length; }
  function rrOutboxClear() { _save([]); _paint(); }

  // ── may this entry be replayed without asking? ───────────────────
  // Three conditions, all required. Exported so the tests can state them.
  function rrOutboxCanAutoRetry(entry) {
    if (!entry) return false;
    if (entry.kind === 'delete') return false;              // never, at all
    if (entry.session !== _session()) return false;         // not across a reload
    if (entry.movedAt !== _rowsMovedAt) return false;       // rows shifted since
    return true;
  }

  // ── retrying ─────────────────────────────────────────────────────
  async function _replay(entry) {
    var a = entry.args || {};
    if (entry.kind === 'update') return sheetsUpdate(a.sheetId, a.range, a.values);
    if (entry.kind === 'append') return sheetsAppend(a.sheetId, a.range, a.values);
    throw new Error('not replayable');
  }

  // opts.force lets the USER retry what this code will not retry on its own —
  // they can see what it is and they are choosing. Deletes stay excluded even
  // then; there is no safe way to re-run one blind.
  async function rrOutboxRetry(opts) {
    opts = opts || {};
    if (_retrying) return { ok: false, why: 'busy' };
    _retrying = true;
    var sent = 0, kept = 0, skipped = 0;
    try {
      var list = _load();
      var still = [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        var allowed = opts.force ? (e.kind !== 'delete') : rrOutboxCanAutoRetry(e);
        if (!allowed) { still.push(e); skipped++; continue; }
        try {
          await _replay(e);
          sent++;
        } catch (err) {
          e.tries = (e.tries || 0) + 1;
          e.why = String((err && err.message) || err || '');
          still.push(e); kept++;
        }
      }
      _save(still);
      _paint();
      if (sent && typeof showToast === 'function') {
        showToast(sent + (sent === 1 ? ' change that had not saved is saved now'
                                     : ' changes that had not saved are saved now'), 4000);
      }
      return { ok: true, sent: sent, kept: kept, skipped: skipped };
    } finally { _retrying = false; }
  }

  // ── telling the user ─────────────────────────────────────────────
  // Quiet when there is nothing to say. A badge, not a modal: the writes that
  // failed are usually recoverable and interrupting an add to say so would be
  // its own kind of rude.
  function _paint() {
    try {
      var n = rrOutboxCount();
      var el = document.getElementById('rr-outbox-badge');
      if (!n) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('button');
        el.id = 'rr-outbox-badge';
        el.onclick = function () { rrOutboxShow(); };
        document.body.appendChild(el);
      }
      el.textContent = n === 1 ? '1 change has not saved' : n + ' changes have not saved';
    } catch (e) {}
  }

  function rrOutboxShow() {
    var list = _load();
    if (!list.length) return;
    var old = document.getElementById('rr-outbox-panel');
    if (old) old.remove();
    var esc = function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    };
    var rows = list.slice(-25).reverse().map(function (e) {
      var what = e.kind === 'delete' ? 'Remove a row'
               : e.kind === 'append' ? 'Add a row'
               : 'Update';
      var where = (e.args && e.args.range) || (e.args && e.args.sheetName) || '';
      var when = '';
      try { when = new Date(e.at).toLocaleString(); } catch (e2) {}
      return '<div class="rr-ob-row"><div class="rr-ob-what">' + esc(what) + ' — ' + esc(where) + '</div>'
           + '<div class="rr-ob-why">' + esc(when) + (e.why ? ' · ' + esc(e.why) : '') + '</div></div>';
    }).join('');
    var anyDelete = list.some(function (e) { return e.kind === 'delete'; });
    var ov = document.createElement('div');
    ov.id = 'rr-outbox-panel';
    ov.innerHTML =
      '<div class="rr-ob-box">'
      + '<div class="rr-ob-h">Changes that have not reached your sheet</div>'
      + '<div class="rr-ob-p">These did not save when they were made — usually a lost connection. '
      +   'Your collection on this device still shows them; your Google Sheet does not yet.</div>'
      + '<div class="rr-ob-list">' + rows + '</div>'
      + (anyDelete
          ? '<div class="rr-ob-note">Removals are listed but never re-run automatically. '
            + 'A sheet row number is a position, and positions move — re-running a removal later '
            + 'could take out a different item. Please remove those again by hand.</div>'
          : '')
      + '<div class="rr-ob-b">'
      +   '<button type="button" id="rr-ob-clear" class="rr-ob-btn">Forget these</button>'
      +   '<button type="button" id="rr-ob-close" class="rr-ob-btn">Close</button>'
      +   '<button type="button" id="rr-ob-retry" class="rr-ob-btn rr-ob-ok">Try again now</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    document.getElementById('rr-ob-close').onclick = function () { ov.remove(); };
    document.getElementById('rr-ob-retry').onclick = function () {
      rrOutboxRetry({ force: true }).then(function (r) {
        ov.remove();
        if (r && r.kept && typeof showToast === 'function') {
          showToast(r.kept + ' still could not save — they are kept for later', 4000, true);
        }
      });
    };
    document.getElementById('rr-ob-clear').onclick = function () {
      if (typeof appConfirm !== 'function') { rrOutboxClear(); ov.remove(); return; }
      appConfirm('Forget the changes that have not saved? They will not be tried again, and '
        + 'your sheet will not have them.', { title: 'Forget these changes', ok: 'Forget them', cancel: 'Keep them' })
        .then(function (yes) { if (yes) { rrOutboxClear(); ov.remove(); } });
    };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  }

  // ── when to try again on our own ─────────────────────────────────
  // The connection coming back is the only signal worth acting on; a timer
  // alone would hammer a sheet that is refusing for a reason.
  function rrOutboxStart() {
    _session();
    _paint();
    try {
      window.addEventListener('online', function () { rrOutboxRetry(); });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) rrOutboxRetry();
      });
    } catch (e) {}
    if (!_timer) {
      _timer = setInterval(function () {
        if (rrOutboxCount()) rrOutboxRetry();
      }, 60000);
    }
  }

  // ── What to SAY when a write fails (v0.9.1247) ──────────────────────
  //
  // 33 places showed the user a raw JavaScript error: "Error: Unexpected
  // token < in JSON at position 0", "Failed to fetch", "Sheets API error 401".
  // Nine of them are the main save handlers, so it appeared on the one action
  // every user performs, and it told them nothing they could act on.
  //
  // Now that a failed write is KEPT (see above), the message can say the one
  // thing that actually matters — whether the change is safe — instead of
  // quoting the machine. `what` is the thing being saved, in the user's
  // words: "your item", "the sale", "this photo".
  //
  // The technical text is not thrown away, it is moved: console.warn keeps it
  // for a debugging session, where it belongs.
  function rrSaveError(err, what, opts) {
    opts = opts || {};
    var raw = String((err && err.message) || err || '');
    try { console.warn('[save] ' + (what || 'write') + ' failed:', raw); } catch (e) {}
    var thing = what || 'your change';
    var kept = opts.kept !== false && rrOutboxCount() > 0;
    var tail = kept ? ' It is kept on this device and will go up on its own.' : '';

    if (raw === 'readonly') {
      return 'Your trial has ended — subscribe to keep adding and editing.';
    }
    // v0.9.1267 (R3): a whole-row write was refused because that row no longer
    // holds the record we meant — the spreadsheet was changed somewhere else.
    // "Please try again" is the wrong advice here: trying again reads the same
    // stale row number and is refused for the same reason. A refresh is the
    // only thing that helps, so this case gets its own words. It is also NOT
    // kept in the outbox — a queued write to a row number that has moved is
    // exactly the write we just refused.
    if (raw === 'ROW_MOVED') {
      return (typeof RR_ROW_MOVED_MSG === 'string' && RR_ROW_MOVED_MSG)
        ? RR_ROW_MOVED_MSG
        : 'That row moved in your spreadsheet — nothing was saved. Refresh and try again.';
    }
    if (raw === 'SESSION_EXPIRED' || /Not signed in|Token required|sign in again|Cannot refresh/i.test(raw)) {
      return 'You have been signed out. Sign in again and ' + thing + ' will save.';
    }
    if (raw === 'offline' || /Failed to fetch|NetworkError|network|ERR_INTERNET/i.test(raw)) {
      return 'No connection, so ' + thing + ' did not reach your sheet.' +
             (kept ? ' It is kept and will go up when you are back on.' : '');
    }
    if (/\b429\b|rate limit|quota/i.test(raw)) {
      return 'Google is asking us to slow down, so ' + thing + ' did not save yet.' + tail;
    }
    if (/\b40[34]\b|permission|PERMISSION_DENIED/i.test(raw)) {
      return 'Your sheet would not accept that change — check it is still shared with this account.' + tail;
    }
    return 'Could not save ' + thing + '.' + (tail || ' Please try again.');
  }
  window.rrSaveError = rrSaveError;

  window.rrOutboxRecord = rrOutboxRecord;
  window.rrOutboxRowsMoved = rrOutboxRowsMoved;
  window.rrOutboxList = rrOutboxList;
  window.rrOutboxCount = rrOutboxCount;
  window.rrOutboxClear = rrOutboxClear;
  window.rrOutboxCanAutoRetry = rrOutboxCanAutoRetry;
  window.rrOutboxRetry = rrOutboxRetry;
  window.rrOutboxShow = rrOutboxShow;
  window.rrOutboxStart = rrOutboxStart;
})();
