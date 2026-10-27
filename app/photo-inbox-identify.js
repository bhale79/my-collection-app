// ═══════════════════════════════════════════════════════════════
// photo-inbox-identify.js — the Photo Inbox identify run, Google Photos, badges, Dashboard card and Quick Capture
//
// Moved WORD FOR WORD out of photo-inbox.js on 2026-10-20 (Photo Inbox split,
// step 7 of PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md — Brad: "yes"). Nothing
// in it changed: Identify my items (the read run), the Google Photos picker, the menu badge and inbox count, the Dashboard inbox card, and phone Quick Capture
//
// One of the Photo Inbox's pieces: it loads with the others, right after
// photo-inbox.js and the pieces before it, and meets them only through
// window._pinShared (PIN — the shared values) and window._pinFns (PINF — the
// hand-over), both made by photo-inbox.js. The window._pin… entry points
// defined here are unchanged.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';
  var PIN = window._pinShared;   // the shared values — made by photo-inbox.js, which loads first
  var PINF = window._pinFns;     // the hand-over — made by photo-inbox.js
  // From app/photo-inbox.js:
  var _setBusy = PINF.from('_setBusy');
  var _pinEtaText = PINF.from('_pinEtaText');
  var _pinReadFid = PINF.from('_pinReadFid');
  var _pinReadFiles = PINF.from('_pinReadFiles');
  var _pinFilesToRead = PINF.from('_pinFilesToRead');
  var _pinBytes = PINF.from('_pinBytes');
  var _tokSave = PINF.from('_tokSave');
  var _pinPreferOf = PINF.from('_pinPreferOf');
  var _status = PINF.from('_status');
  var _pinBusyBounce = PINF.from('_pinBusyBounce');
  var _folder = PINF.from('_folder');
  var _pinActiveEra = PINF.from('_pinActiveEra');
  var _pinSetHomeEra = PINF.from('_pinSetHomeEra');
  var _pinRenderBar = PINF.from('_pinRenderBar');
  var _pinEraLabel = PINF.from('_pinEraLabel');
  var _pinHomeEra = PINF.from('_pinHomeEra');
  var _stageOne = PINF.from('_stageOne');
  var _stageRenderStrip = PINF.from('_stageRenderStrip');
  var _pinMetaSet = PINF.from('_pinMetaSet');
  var _stageDrain = PINF.from('_stageDrain');
  // Fixed settings from app/photo-inbox.js (handed over once it has loaded, never changed):
  var READER_VER = PINF.READER_VER;
  var COUNT_KEY = PINF.COUNT_KEY;
  // From the other pieces:
  var _pinAiHints = PINF.from('_pinAiHints');
  var _pinReconcileAiNum = PINF.from('_pinReconcileAiNum');
  var _idsSave = PINF.from('_idsSave');
  var _render = PINF.from('_render');
  var _pinOfflineRefuse = PINF.from('_pinOfflineRefuse');
  var _selGroups = PINF.from('_selGroups');
  var _pinOffline = PINF.from('_pinOffline');
  var _flushPending = PINF.from('_flushPending');
  var _repairMissingPhotoLinks = PINF.from('_repairMissingPhotoLinks');
  var _backfillMasterKeys = PINF.from('_backfillMasterKeys');
  var _backfillMasterRowIds = PINF.from('_backfillMasterRowIds');
  // Handed over to the other pieces (function declarations are hoisted):
  Object.assign(PINF, { _qcToken: _qcToken, _navBadge: _navBadge, _pinPanelFill: _pinPanelFill, _pinIdentifyRun: _pinIdentifyRun, _pinGPStatus: _pinGPStatus });

  async function _pinIdentifyRun(todo, ids) {
    _setBusy(true, 'Identifying items'); PIN._idAbort = false;
    var okN = 0, blankN = 0, failN = 0, guessN = 0;
    var remaining = null;   // v0.9.887 (Brad): reads-left-today tracker
    var _idStart = Date.now();   // v0.9.1174
    try {
      for (var i = 0; i < todo.length; i++) {
        if (PIN._idAbort) break;
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
            (typeof PIN._vfNote !== 'undefined' && PIN._vfNote[g.key]) ? { note: PIN._vfNote[g.key] } : null);
          var ai = (typeof aiIdentifyImage2 === 'function')
            ? await aiIdentifyImage2(blobs, _hints)
            : await aiIdentifyImage(blobs[0], _hints);
          // v0.9.1163: the batch used to break on 'quota' ONLY and otherwise
          // carry on to the next group. With reads switched off that meant
          // grinding silently through all 59 photos, spending nothing and
          // achieving nothing. Anything that will fail identically for every
          // remaining group must STOP the run and say why.
          if (!ai.ok && (ai.reason === 'quota' || ai.reason === 'optout'
                         || ai.reason === 'offline' || ai.reason === 'norelay' || ai.reason === 'notbeta')) {
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
          'If it stays broken, let us know at <a href="mailto:support@therailroster.com" style="color:var(--t-accent)">support@therailroster.com</a>.' +
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
    if (_pinOfflineRefuse('a Google Photos import')) return;
    if (PIN._busy) { _pinBusyBounce(); return; }
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
        var _gpWords = (typeof rrGPhotosErrorWords === 'function') ? rrGPhotosErrorWords(pick) : '';   // v0.9.2030: Google's reason, in words
        if (pick.error === 'scope') showToast(rrGPhotosErrText(pick), 9000, true);   // v0.9.2032: the ONE config line (RR_GPHOTOS_WAIT.err_scope), no typed copy
        else if (_gpWords) showToast(_gpWords, 9000, true);
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
    if (PIN._busy) { _pinBusyBounce(); return; }
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
      PIN._sel = {};
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
              + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px">photo' + (n === 1 ? '' : 's') + ' waiting — ' + (window.IS_MOBILE_UA ? 'tap' : 'click') + ' to file</div>' };
          }
        });
      }
      if (typeof _CARD_HELP !== 'undefined') _CARD_HELP.photoInbox = window.IS_MOBILE_UA
        ? 'Photos waiting in your Photo Inbox — snapped with Batch Add, or imported from Google Photos. Tap the card to review and file them.'
        : 'Photos waiting in your Photo Inbox — snapped with Batch Add on your phone, dragged in on desktop, or imported from Google Photos. Click the card to review and file them.';
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
            // v0.9.1834 (N3): once a list has been seen, a rebuild draws it
            // again at once (_pinPanelDrawLast, from the buildDashboard
            // wrapper) instead of showing "Loading inbox…" while Drive is
            // asked again. The words are only for the very first draw.
            return '<div id="pin-panel-grid" onclick="window._fromDash=true;_pinGo()" title="Open Photo Inbox" style="cursor:pointer;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:0.5rem;min-height:120px">'
              + (_pinPanelLast ? '' : '<div class="empty-state"><p>Loading inbox…</p></div>') + '</div>';
          }
        });
      }
    } catch (e) { console.warn('[Inbox] dash register:', e); }
  }

  // ══ v0.9.1834 (N3) — THE CARD KEEPS ITS PICTURES THROUGH A REBUILD ══════
  // The dashboard is rebuilt on every data event, and every rebuild used to
  // put "Loading inbox…" on this card, ask Drive for the list again (a round
  // trip), and only then draw the tiles — so the inbox photos blanked and
  // reloaded for no reason the user could see. Now the last list is kept:
  // a rebuild draws it at once (from the buildDashboard wrapper, before the
  // browser paints), Drive is still asked, and the tiles are redrawn only
  // when the list actually changed. One drawer for both paths.
  var _pinPanelLast = null;      // the files Drive last listed for the card
  function _pinPanelKey(files) { return (files || []).map(function (f) { return f && f.id; }).join(','); }
  function _pinPanelDraw(grid, files) {
    if (!grid) return;
    if (!files.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Inbox is empty — snap some photos with Batch Add</p></div>';
      grid.setAttribute('data-pin-key', '');
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
    // v0.9.1809: as many whole rows as the card holds now that the cards
    // are one height (was a fixed 3 — left an empty band on a tall window)
    var _rows = (typeof window._dashPhotoRowsFit === 'function') ? window._dashPhotoRowsFit(grid, cols) : 3;
    var show = files.slice(0, cols * _rows);
    grid.innerHTML = show.map(function (f) {
      return '<div style="aspect-ratio:var(--rr-photo-tile-ratio);border-radius:8px;overflow:hidden;background:var(--surface2,#26262e)"><img loading="lazy" data-ppfid="' + f.id + '" class="rr-fit" style="width:100%;height:100%;display:block" alt=""></div>';
    }).join('');
    grid.setAttribute('data-pin-key', _pinPanelKey(files));
    grid.querySelectorAll('img[data-ppfid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-ppfid'), img, img.parentElement, null, 'hi');
    });
  }
  // A rebuild's fresh card, drawn from the last list before anything is asked.
  function _pinPanelDrawLast() {
    try {
      var grid = document.getElementById('pin-panel-grid');
      if (!grid || !_pinPanelLast || grid.querySelector('img[data-ppfid]')) return false;
      _pinPanelDraw(grid, _pinPanelLast);
      return true;
    } catch (e) { return false; }
  }
  if (typeof window !== 'undefined') window._pinPanelDrawLast = _pinPanelDrawLast;

  async function _pinPanelFill() {
    var grid = document.getElementById('pin-panel-grid');
    if (!grid || !_qcToken()) return;
    _pinPanelDrawLast();
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
      _pinPanelLast = files;
      // the same list as the tiles on screen — leave them be
      if (grid.getAttribute('data-pin-key') === _pinPanelKey(files) && (files.length ? grid.querySelector('img[data-ppfid]') : true)) return;
      _pinPanelDraw(grid, files);
    } catch (e) {
      // a failed ask never blanks tiles that are already showing
      if (grid && !grid.querySelector('img[data-ppfid]')) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Couldn’t load the inbox — open it to retry</p></div>';
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

  // ══ v0.9.1699 (Brad, on a phone): "i added pictures, i hit done, and the
  //    photos were not in there. i had to click dashboard before they showed
  //    up" — and separately "it said to wait or i might lose the pictures.
  //    can we not hit done, and it wait till the pictures are loaded so we
  //    don't loose them".
  //
  //    Two faults, one shape. _upload() (drop / picker / desktop) ends in
  //    _pinRefresh(); this Quick Capture path never did, so the only thing
  //    that noticed new shots was the buildDashboard hook further down —
  //    hence "click Dashboard and they appear". And a failed upload sat in
  //    _qc.failed holding the only copy of the photo in memory, which is why
  //    Done had to warn about losing them.
  //
  //    The counter below is why closing instantly is now safe. Upload
  //    bookkeeping used to live on _qc, which Done sets to null — so an
  //    upload still in flight when the sheet closed would throw on the way
  //    out, and a FAILED one would throw before it could be rescued. Flight
  //    is counted here instead, outside the UI session, so Done can close
  //    whenever it likes and the uploads finish on their own.
  var _qcFlight = 0;      // uploads in the air right now (survives Done)
  var _qcRescued = 0;     // failed → saved to this device instead of lost
  var _qcLanded = 0;      // reached Drive
  var _qcClosedMid = false;   // Done was pressed while some were still flying

  function _qcToken() {
    if (!window.accessToken) {
      var s = localStorage.getItem('lv_token'), ex = parseInt(localStorage.getItem('lv_token_expiry') || '0', 10);
      if (s && ex > new Date().getTime()) window.accessToken = s;
    }
    return window.accessToken;
  }

  window._qcOpen = function () {
    // v0.9.1590: Quick Capture works offline — shots stage on the device.
    // v0.9.1699: a fresh sheet starts fresh counters. _qcFlight is deliberately
    // NOT reset — shots from a previous sheet may still be in the air, and
    // zeroing it here would fire _qcAllLanded() early.
    if (!_qc) { _qc = { base: new Date().getTime(), group: 1, shots: 0, total: 0, pending: 0, failed: [], recent: [], nextIsNew: false, view: 'RSV', used: {} }; _qcLanded = 0; _qcRescued = 0; }
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

  // v0.9.1433: the view sequence. Right Side first — the app's own
  // orientation-tip convention and the catalog's money shot. 'EXTRA2' is the
  // repeatable "Another Detail"; both detail buttons stamp 'EXTRA'.
  // v0.9.1437 (Brad's guide): the order you actually WALK around an item on a
  // table — right side, front, left side, back — then top, bottom, details.
  var _QC_VIEWS = [
    ['RSV', 'Right Side'], ['FV', 'Front'], ['LSV', 'Left Side'], ['BKV', 'Back'],
    ['TV', 'Top'], ['BV', 'Bottom'], ['EXTRA', 'Detail 1'], ['EXTRA2', 'Another Detail']
  ];
  function _qcViewLabel(k) {
    for (var i = 0; i < _QC_VIEWS.length; i++) if (_QC_VIEWS[i][0] === k) return _QC_VIEWS[i][1];
    return k;
  }
  function _qcNextView() {
    for (var i = 0; i < _QC_VIEWS.length; i++) {
      var k = _QC_VIEWS[i][0];
      if (k === 'EXTRA2') continue;
      if (!_qc.used[k]) return k;
    }
    return 'EXTRA2';
  }
  window._qcPickView = function (k) { _qc.view = k; _qcRender(); };

  // v0.9.1725: change what is being stamped WITHOUT leaving the capture sheet.
  // The same picker every other surface uses — its overlay is z-index 10050 and
  // this sheet is 10000, so it opens on top rather than behind, which is the
  // whole bug this row exists to answer.
  // Whatever he picks becomes the session's home era and any armed one-shot is
  // dropped: the label he just chose is what the next shot must get, and a
  // one-shot still armed underneath would quietly take the very next photo.
  window._qcPickEra = function () {
    if (typeof window._pinPickContext !== 'function') return;
    window._pinPickContext({
      title: 'What are you photographing?',
      blurb: 'Every shot from here on is stamped with this.',
      okLabel: 'Use this',
      cancelLabel: 'Leave it as it is',
      current: _pinActiveEra(),
      onPick: function (era) {
        _pinSetHomeEra(era);
        PIN._pinOneShot = null;
        try { _pinRenderBar(); } catch (e) {}
        _qcRender();
      },
    });
  };

  function _qcCropOn() { return localStorage.getItem(QC_CROP_KEY) === '1'; }
  window._qcCropToggle = function () {
    localStorage.setItem(QC_CROP_KEY, _qcCropOn() ? '0' : '1');
    _qcRender();
  };

  function _qcRender() {
    var body = document.getElementById('qc-body');
    if (!body) return;
    if (!_qc.view) _qc.view = 'RSV';
    if (!_qc.used) _qc.used = {};
    var counter = 'Item ' + _qc.group + (_qc.shots ? ' · ' + _qc.shots + ' photo' + (_qc.shots > 1 ? 's' : '') : '');
    var pend = '';
    if (_qc.pending > 0) pend += 'Uploading ' + _qc.pending + '… ';
    if (_qc.failed.length) pend += '<span style="color:var(--t-red);font-weight:700">' + _qc.failed.length + ' failed</span> <button onclick="_qcRetry()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Retry</button>';
    // Most-recent strip (newest first). Tap a shot to review / re-crop.
    var strip = '';
    if (_qc.recent.length) {
      strip = '<div style="display:flex;gap:0.45rem;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0.15rem 0.1rem;margin-bottom:0.6rem">' +
        _qc.recent.slice().reverse().map(function (r, i) {
          var realIdx = _qc.recent.length - 1 - i;
          return '<div onclick="_qcReview(' + realIdx + ')" style="flex-shrink:0;width:62px;height:62px;border-radius:9px;overflow:hidden;position:relative;border:2px solid ' + (r.group === _qc.group ? '#2980b9' : 'var(--border)') + ';cursor:pointer">' +
            '<img src="' + r.url + '" class="rr-fit" style="width:100%;height:100%;display:block" alt="">' +
            '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);color:#fff;font-size:0.55rem;text-align:center;padding:0 2px">Item ' + r.group + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }
    // ══ v0.9.1725 (Brad, 2026-09-12) — SAY IT ON THE SCREEN HE IS LOOKING AT ══
    // v0.9.1724 fixed the stamp; this is why the missing stamp survived a whole
    // shoot. The capture sheet is full-screen, so the context bar reading "Now
    // shooting Lionel Postwar" sits BEHIND it the entire time you take pictures.
    // Nothing on screen ever contradicted him, and 66 photos went by.
    // This file already knows the rule, from the tagging bar: "A tag you cannot
    // see is a tag you cannot trust — after tagging 80 photos you want to SEE it."
    // Tapping it opens the same era picker every other surface uses (_PIN_SHEET_OV
    // is z-index 10050, above this sheet's 10000), so a wrong era is fixed where
    // you notice it rather than after the fact.
    // Colours are tokens only: photo-inbox.js is AT its hardcoded-colour budget,
    // 232 of 232, and the ratchet refuses a 233rd.
    var _qcEraKey = _pinActiveEra();
    var _qcEraRow =
      '<button onclick="_qcPickEra()" style="display:flex;align-items:center;gap:0.5rem;width:100%;'
        + 'padding:0.45rem 0.7rem;margin-bottom:0.6rem;border-radius:9px;text-align:left;cursor:pointer;'
        + 'border:1.5px solid ' + (_qcEraKey ? 'var(--info)' : 'var(--accent)') + ';background:var(--surface2);'
        + 'color:' + (_qcEraKey ? 'var(--info)' : 'var(--t-accent)') + ';font-family:var(--font-body);font-size:0.8rem;min-height:38px">'
      + '<span style="font-size:0.64rem;letter-spacing:0.07em;text-transform:uppercase;color:var(--text-dim);font-weight:700;flex-shrink:0">Tagging</span>'
      + '<span style="font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + rrEsc(_qcEraKey ? _pinEraLabel(_qcEraKey) : 'Nothing — reads will be unfiltered') + '</span>'
      + '<span style="color:var(--text-dim);flex-shrink:0">' + (_qcEraKey ? 'Change' : 'Set') + ' ▾</span>'
      + '</button>';
    body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">' +
        '<span style="font-family:var(--font-head);font-weight:700;font-size:1.05rem;color:var(--text)">Quick Capture</span>' +
        '<button onclick="_qcCropToggle()" style="border:1px solid ' + (_qcCropOn() ? '#2980b9' : 'var(--border)') + ';background:' + (_qcCropOn() ? 'rgba(41,128,185,0.15)' : 'var(--surface2)') + ';color:' + (_qcCropOn() ? 'var(--t-link)' : 'var(--text-dim)') + ';border-radius:7px;font-size:0.7rem;font-weight:700;padding:0.25rem 0.6rem;cursor:pointer;font-family:var(--font-body)">Crop each photo: ' + (_qcCropOn() ? 'ON' : 'OFF') + '</button>' +
      '</div>' +
      _qcEraRow +
      '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4rem;min-height:0">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1.5rem;color:var(--text);text-align:center">' + counter + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-dim);min-height:1.2em;text-align:center">' + (pend || (_qc.total ? _qc.total + ' photo' + (_qc.total > 1 ? 's' : '') + ' in your inbox' : 'Photos upload as you go')) + '</div>' +
      '</div>' +
      strip +
      '<button onclick="_qcTake(true)" style="width:100%;min-height:18vh;border-radius:16px;border:none;background:#2980b9;color:#fff;font-family:var(--font-body);font-weight:700;font-size:1.1rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.45rem;margin-bottom:0.6rem">' +
        '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
        'Photo of New Item' +
      '</button>' +
      // v0.9.1433 (Brad): each shot is stamped with WHICH SIDE it shows, so
      // the wizard can file it straight into the matching slot. The next-photo
      // button names the view it will take; the row below shows the whole
      // sequence — the coming view highlighted, finished views grayed (still
      // tappable to re-shoot one), and Another Detail never runs out.
      '<button onclick="_qcTake(false)" ' + (_qc.shots ? '' : 'disabled ') + 'style="width:100%;min-height:11vh;border-radius:16px;border:1.5px solid ' + (_qc.shots ? '#2980b9' : '#8b8e94') + ';background:rgba(41,128,185,' + (_qc.shots ? '0.14' : '0.05') + ');color:' + (_qc.shots ? 'var(--t-link)' : 'var(--text-dim)') + ';font-family:var(--font-body);font-weight:700;font-size:1rem;cursor:pointer;margin-bottom:0.5rem;opacity:' + (_qc.shots ? '1' : '0.55') + '">Next Photo of Same Item \u2014 ' + _qcViewLabel(_qc.view) + '</button>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.6rem">' +
        _QC_VIEWS.map(function (v) {
          var k = v[0], done = !!_qc.used[k], cur = (k === _qc.view);
          return '<button onclick="_qcPickView(\'' + k + '\')" style="flex:1 1 22%;min-width:72px;padding:0.5rem 0.2rem;border-radius:9px;font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer;'
            + 'border:2px solid ' + (cur ? '#2980b9' : (done ? 'var(--border)' : 'var(--border)')) + ';'
            + 'background:' + (cur ? 'rgba(41,128,185,0.22)' : (done ? 'var(--surface2)' : 'var(--bg)')) + ';'
            + 'color:' + (cur ? 'var(--t-link)' : (done ? '#8b8e94' : 'var(--text-mid)')) + ';'
            + (done && !cur ? 'opacity:0.55;' : '') + '">'
            + v[1] + (done ? ' \u2713' : '') + '</button>';
        }).join('') +
      '</div>' +
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
    if (_qc.nextIsNew && _qc.shots > 0) { _qc.group++; _qc.shots = 0; _qc.used = {}; _qc.view = 'RSV'; }   // v0.9.1433: new item restarts the view sequence
    _qc.nextIsNew = false;
    var go = function (finalFile) {
      _qc.shots++;
      _qc.total++;
      var ext = ((finalFile.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5) || 'jpg';
      var name = 'INBOX ' + _qc.base + ' g' + _qc.base + '-' + _qc.group + ' p' + _qc.shots + '.' + ext;
      // v0.9.1433: stamp the shot with the view that was lit when it was taken,
      // then gray that view out and walk the highlight to the next unused one.
      var _vStamp = (_qc.view === 'EXTRA2') ? 'EXTRA' : _qc.view;
      // ══ v0.9.1724 (Brad, 2026-09-12) — AND THE ERA, WHICH NEVER RODE ALONG ══
      // "i did the photo inbox add with my phone and i tagge the photos, but it
      //  didn't tag the photos. I had to retag them in the inbox."
      // He had. Add photos asks "What are you about to photograph?", he answered,
      // the bar read "Now shooting Lionel Postwar" — and this path then stamped
      // the VIEW and nothing else. _upload (the drop / camera-roll path) has
      // always written { era, stat:'stamped' } right beside its upload; Quick
      // Capture simply never did, on any of its three routes.
      // The cost was not the re-tagging. His 66 photos were read while untagged,
      // and an untagged read has no catalog to check against: one came back
      // "81153 — CSX SD70MAC", high confidence, a number that exists ONLY in
      // Lionel MPC-Modern, pieced together out of the fragments 173/64273/
      // 1153/153. With the postwar tag in force the era gate rejects that row
      // outright — there was just no tag for it to use.
      // Same one-shot rule as _upload: an armed one-shot is spent by THIS shot
      // and springs back, so one odd item cannot leak into the next forty.
      var _eStamp = PIN._pinOneShot || _pinHomeEra();
      if (PIN._pinOneShot) { PIN._pinOneShot = null; try { _pinRenderBar(); } catch (eB) {} }
      var rec = { url: URL.createObjectURL(finalFile), name: name, driveId: null, group: _qc.group, view: _vStamp, era: _eStamp };
      if (_qc.view !== 'EXTRA2') _qc.used[_qc.view] = 1;
      _qc.view = _qcNextView();
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
    // v0.9.1590: offline shot — stage it on the device instead of letting the
    // upload fail into the will-be-lost list. The view stamp rides the staged
    // record and lands as Drive appProperties when the drain uploads it.
    if (_pinOffline()) {
      try {
        // v0.9.1724: the era rides the staged record too, or a shot taken out
        // of signal arrives in the inbox stripped of the tag the bar promised.
        await _stageOne(file, name, (rec && rec.era) || '', (rec && rec.view) || '');
        if (rec) rec.staged = true;
        try { await _stageRenderStrip(); } catch (e) {}
      } catch (eS) {
        console.warn('[QuickCapture] could not stage offline shot:', eS);
        if (_qc) _qc.failed.push({ file: file, name: name, rec: rec });
      }
      try { _qcRender(); } catch (e) {}
      return;
    }
    _qcFlight++;
    if (_qc) { _qc.pending++; _qcRender(); }
    try {
      if (!_qcToken()) throw new Error('signed out');
      var fid = await _folder();
      var res = await driveUploadFile(file, name, fid);
      if (rec && res && res.id) rec.driveId = res.id;
      // v0.9.1433: the view stamp survives as Drive appProperties, same rails
      // as every other photo tag — the wizard reads it at add time.
      // v0.9.1724: the ERA goes on with it. 'stamped' rides only with an era —
      // _pinStatusOf derives status from era presence, so claiming it without
      // one would put the photo in the Tagged filter with nothing behind it.
      if (rec && res && res.id && (rec.view || rec.era)) {
        var _qMeta = {};
        if (rec.view) _qMeta.view = rec.view;
        if (rec.era) { _qMeta.era = rec.era; _qMeta.stat = 'stamped'; }
        try { await _pinMetaSet(res.id, _qMeta); } catch (eV) {}
      }
      _qcLanded++;
    } catch (e) {
      // v0.9.1699: a failed shot is RESCUED, not mourned. The photo goes to
      // the same device store an offline shot uses, so _stageDrain() uploads
      // it when the connection is back. Before this, _qc.failed held the only
      // copy — in memory — and closing the app lost it for good. That is the
      // fact the old "they may not reach the inbox" warning was reporting,
      // and rescuing the file is what lets the warning go away.
      console.warn('[QuickCapture] upload failed — rescuing to this device:', e);
      var _saved = false;
      try {
        // v0.9.1724: a rescued shot keeps its era as well as its view.
        await _stageOne(file, name, (rec && rec.era) || '', (rec && rec.view) || '');
        _saved = true; _qcRescued++;
        if (rec) rec.staged = true;
        try { await _stageRenderStrip(); } catch (eStrip) {}
      } catch (eS) {
        console.warn('[QuickCapture] rescue failed too:', eS);
      }
      // Only a photo we could not even save to the device belongs on the
      // failed list — that list is what the in-sheet Retry button works from.
      if (!_saved && _qc) _qc.failed.push({ file: file, name: name, rec: rec });
    } finally {
      _qcFlight--;
      if (_qc) { _qc.pending--; _qcRender(); }
      if (_qcFlight <= 0) { _qcFlight = 0; _qcAllLanded(); }
    }
  }

  // ── Everything that was in the air has settled ────────────────
  // This is the moment the inbox is actually worth re-reading, and it is the
  // fix for "I had to click Dashboard". It runs whether or not the capture
  // sheet is still open, so closing early costs nothing.
  function _qcAllLanded() {
    try { _pinCountRefresh(); } catch (e) {}
    try {
      // Redraw the grid only when the inbox is the page on screen — the same
      // test the Discard path uses. _pinGo() refreshes on arrival anyway, so
      // there is nothing to gain by re-reading Drive for a page nobody is on.
      if (document.querySelector('#page-photo-inbox.active') && typeof window._pinRefresh === 'function') {
        window._pinRefresh();
      }
    } catch (e) {}
    // Only chase the staged store when something actually LANDED. If every
    // shot in this batch failed, the connection is down and a drain would
    // just fail again and bump each record's retry count for nothing — the
    // drain already runs on reconnect and on every _pinRefresh().
    if (_qcLanded) { try { _stageDrain(); } catch (e) {} }
    if (_qcClosedMid) {
      _qcClosedMid = false;
      var msg = _qcLanded
        ? ('All ' + _qcLanded + ' photo' + (_qcLanded > 1 ? 's are' : ' is') + ' in your inbox')
        : '';
      if (_qcRescued) {
        msg += (msg ? ' \u2014 ' : '')
          + _qcRescued + ' saved on this phone, uploading when you\u2019re back online';
      }
      if (msg) { try { showToast(msg, 3500); } catch (e) {} }
    }
    _qcLanded = 0; _qcRescued = 0;
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
    if (typeof window._openCropper !== 'function' || typeof window._cropOpenDriveFile !== 'function') { showToast('Crop tool still loading — try again in a moment', 2500, true); return; }
    var rv = document.getElementById('qc-review-ov'); if (rv) rv.remove();
    // v0.9.1872: the crop screen works on the photo IN DRIVE, through the ONE
    // Drive-aware screen (photo-crop.js) — the original protected, the current
    // crop drawn on it, Restore original offered — and the strip shows what
    // Drive now holds. A shot still in the air has nothing to crop yet; the
    // old "crop saved locally — inbox copy may be the original" split is gone.
    if (!r.driveId || !_qcToken()) { showToast('Photo is still uploading — try the crop again in a few seconds', 3000); return; }
    window._cropOpenDriveFile(r.driveId, {
      src: r.url,
      onDone: function (ok, blob, kind) {
        if (!ok) { showToast('Could not update the uploaded copy — try again', 2500, true); return; }
        try { URL.revokeObjectURL(r.url); } catch (e) {}
        r.url = URL.createObjectURL(blob);
        _qcRender();
        showToast(kind === 'restore' ? 'Original restored' : 'Photo updated', 2500);
      },
    });
  };

  // v0.9.1325 made this async because two native confirm() dialogs became
  // appConfirm. v0.9.1699 removed both dialogs, so nothing here awaits any
  // more — it stays async only because every caller invokes it from an
  // onclick and ignores the return value, so the signature is free to keep
  // and changing it would churn the callers and the pins for no gain.
  // (The reason native confirm() is banned in this file is still live: see
  // the _pinDiscard note above — it would freeze the extension bridge.)
  // v0.9.1699 (Brad): Done CLOSES, immediately, every time. Both dialogs are
  // gone — "still uploading, leave anyway?" and "failed and will be lost".
  //
  // They asked the user to make a decision the app is better placed to make,
  // and the second one stated a fact that is no longer true: a failed shot is
  // now rescued to this device by _qcUpload and drained later. Nothing is
  // lost by closing, so there is nothing to warn about.
  //
  // Uploads still in the air are NOT abandoned — _qcFlight is counted outside
  // this session object, so they run to completion after the sheet is gone and
  // _qcAllLanded() refreshes the inbox and the badge when the last one settles.
  window._qcDone = async function () {
    var flying = _qcFlight;
    var landed = _qcLanded, rescued = _qcRescued;
    if (_qc) _qc.recent.forEach(function (r) { try { URL.revokeObjectURL(r.url); } catch (e) {} });
    var rv = document.getElementById('qc-review-ov'); if (rv) rv.remove();
    var ov = document.getElementById('qc-ov');
    if (ov) ov.remove();
    if (window.BackStack && BackStack.pop) BackStack.pop('qc-ov');
    _qc = null;
    if (flying > 0) {
      // Say what is true right now; _qcAllLanded() speaks again when they land.
      _qcClosedMid = true;
      showToast(flying + ' photo' + (flying > 1 ? 's are' : ' is') + ' still uploading \u2014 '
        + (flying > 1 ? 'they' : 'it') + '\u2019ll finish on '
        + (flying > 1 ? 'their' : 'its') + ' own, you can carry on', 3500);
      return;   // the refresh + the final word come from _qcAllLanded()
    }
    var msg = landed
      ? (landed + ' photo' + (landed > 1 ? 's' : '') + ' in your inbox \u2014 open the Photo Inbox to file them whenever you\u2019re ready')   // v0.9.1920 (camera list #6): phone-only toast, no desk
      : '';
    if (rescued) {
      msg += (msg ? ' \u2014 ' : '')
        + rescued + ' saved on this phone, uploading when you\u2019re back online';
    }
    if (msg) showToast(msg, 3500);
    // Nothing was in the air, so the folder is settled: re-read it now. This
    // is the missing line that made the photos invisible until a dashboard
    // rebuild — _upload() has always ended this way.
    _qcAllLanded();
  };

  // ── Batch Add — lives in the Add-to-My-Collection wizard footer,
  //    to the right of Cancel, first step only (Brad's placement).
  //    Phone → Quick Capture camera; desktop → Photo Inbox page.
  window._qcBatchAdd = function () {
    try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
    if (window.IS_MOBILE_UA) window._qcOpen();
    else window._pinGo(document.getElementById('nav-photo-inbox'));
  };

  // v0.9.1711: _batchBtnSync (removed a stray #qc-batch-btn that nothing has
  // built since Batch Add moved to the +Add menu) is gone.

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
          _pinPanelDrawLast();   // v0.9.1834: the inbox card's pictures are back before the browser paints
          _injectNav(); _flushPending(); _repairMissingPhotoLinks(); _backfillMasterKeys();
          _backfillMasterRowIds();   // v0.9.1882: runs once the full catalog index is complete (its completion rebuilds the dashboard)
          window._pinFlushPendingNow = _flushPending;   // v0.9.1602: reconnect + drain-chain kick
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
