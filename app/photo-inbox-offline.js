// ═══════════════════════════════════════════════════════════════
// photo-inbox-offline.js — the Photo Inbox offline staging, show-mode filing and upload
//
// Moved WORD FOR WORD out of photo-inbox.js on 2026-10-20 (Photo Inbox split,
// step 8 of PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md — Brad: "yes"). Nothing
// in it changed: offline photo staging on this device (IndexedDB), show-mode filing onto items offline, the drain back to Drive, the waiting strip, and the import / Batch Add / upload path
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
  var _pinHomeEra = PINF.from('_pinHomeEra');
  var _pinRenderBar = PINF.from('_pinRenderBar');
  var _folder = PINF.from('_folder');
  var _pinMetaSet = PINF.from('_pinMetaSet');
  var _pinSetHomeEra = PINF.from('_pinSetHomeEra');
  var _pinEraLabel = PINF.from('_pinEraLabel');
  var _pinBusyBounce = PINF.from('_pinBusyBounce');
  var _setBusy = PINF.from('_setBusy');
  var _pinActiveEra = PINF.from('_pinActiveEra');
  var _status = PINF.from('_status');
  // From the other pieces:
  var _pinOffline = PINF.from('_pinOffline');
  var _qcToken = PINF.from('_qcToken');
  var _flushPending = PINF.from('_flushPending');
  // Handed over to the other pieces (function declarations are hoisted):
  Object.assign(PINF, { _upload: _upload, _stageRenderStrip: _stageRenderStrip, _stageDrain: _stageDrain, _inboxCacheLoad: _inboxCacheLoad, _inboxCacheSave: _inboxCacheSave, _stageOne: _stageOne });

  // ═══ v0.9.1590: LOCAL PHOTO STAGING (Session 87 release 2) ═══════════
  //
  // The v1589 guard stopped offline photo adds from silently vanishing by
  // refusing them. This is the feature the guard was holding the door for:
  // offline adds now land in an IndexedDB blob store ON THIS DEVICE, show in
  // the inbox as a "waiting to upload" strip, and go up on their own when the
  // connection returns — then flow through the normal Drive pipeline
  // (unchanged). Rules:
  //   • A staged photo is deleted ONLY after Drive confirms the upload (an
  //     id came back). A failed upload keeps the record and retries later.
  //   • One drain at a time (_stageDraining), and a cross-tab lock in
  //     localStorage so two tabs cannot both drain the same store into
  //     duplicate uploads.
  //   • Every IndexedDB touch is wrapped: storage failing must degrade to
  //     the v1589 refusal, never to a crash or a silent loss.
  //   • Google Photos import still refuses offline — its picker IS the
  //     network; there is nothing local to stage.
  var _STAGE_DB = 'rr_photo_stage', _STAGE_STORE = 'photos';
  var _STAGE_LOCK = 'rr_stage_drain_lock';
  var _stageDraining = false;
  var _stageUrls = [];

  // v0.9.1601: version 2 adds the inbox's OFFLINE MEMORY — the last-loaded
  // listing (ids, names, tags) and a thumbnail store — beside the staged
  // photos. Existing v1 databases upgrade in place; every create is guarded
  // so a store that already exists never fails the open.
  var _CACHE_STORE = 'inbox_cache', _THUMB_STORE = 'thumbs';
  function _stageOpen() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open(_STAGE_DB, 2);
      rq.onupgradeneeded = function () {
        var db = rq.result;
        [_STAGE_STORE, _CACHE_STORE, _THUMB_STORE].forEach(function (st) {
          try { if (!db.objectStoreNames || !db.objectStoreNames.contains || !db.objectStoreNames.contains(st)) db.createObjectStore(st, { keyPath: 'id' }); } catch (e) {}
        });
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej((rq && rq.error) || new Error('idb open failed')); };
    });
  }
  function _idbPut(store, rec) {
    return _stageOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(rec);
        tx.oncomplete = function () { try { db.close(); } catch (e) {} res(true); };
        tx.onerror = function () { try { db.close(); } catch (e) {} rej((tx && tx.error) || new Error('idb write failed')); };
      });
    });
  }
  function _idbGet(store, id) {
    return _stageOpen().then(function (db) {
      return new Promise(function (res) {
        var rq = db.transaction(store, 'readonly').objectStore(store).get(id);
        rq.onsuccess = function () { try { db.close(); } catch (e) {} res(rq.result || null); };
        rq.onerror = function () { try { db.close(); } catch (e) {} res(null); };
      });
    }).catch(function () { return null; });
  }
  function _idbAll(store) {
    return _stageOpen().then(function (db) {
      return new Promise(function (res) {
        var rq = db.transaction(store, 'readonly').objectStore(store).getAll();
        rq.onsuccess = function () { try { db.close(); } catch (e) {} res(rq.result || []); };
        rq.onerror = function () { try { db.close(); } catch (e) {} res([]); };
      });
    }).catch(function () { return []; });
  }
  function _idbDel(store, id) {
    return _stageOpen().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = function () { try { db.close(); } catch (e) {} res(true); };
        tx.onerror = function () { try { db.close(); } catch (e) {} res(false); };
      });
    }).catch(function () { return false; });
  }

  // the inbox's saved listing + the thumbnail bank (window-shared so
  // drive.js's thumbnail loader can read and feed it)
  function _inboxCacheSave(files) {
    var slim = files.map(function (f) {
      return { id: f.id, name: f.name, createdTime: f.createdTime, appProperties: f.appProperties || {} };
    });
    return _idbPut(_CACHE_STORE, { id: 'listing', at: Date.now(), files: slim });
  }
  function _inboxCacheLoad() { return _idbGet(_CACHE_STORE, 'listing'); }
  var _thumbPutCount = 0;
  window._rrThumbCache = {
    get: function (fileId) { return _idbGet(_THUMB_STORE, fileId).then(function (r) { return r && r.blob ? r.blob : null; }); },
    put: function (fileId, blob) {
      var pr = _idbPut(_THUMB_STORE, { id: fileId, blob: blob, at: Date.now() }).catch(function () {});
      // a light prune every 25 puts: keep the newest ~600 thumbnails
      if ((++_thumbPutCount % 25) === 0) {
        _idbAll(_THUMB_STORE).then(function (list) {
          if (list.length <= 600) return;
          list.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
          list.slice(0, list.length - 600).forEach(function (r) { _idbDel(_THUMB_STORE, r.id); });
        });
      }
      return pr;
    },
  };
  function _stageWrite(fn) {
    return _stageOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(_STAGE_STORE, 'readwrite');
        fn(tx.objectStore(_STAGE_STORE));
        tx.oncomplete = function () { try { db.close(); } catch (e) {} res(true); };
        tx.onerror = function () { try { db.close(); } catch (e) {} rej((tx && tx.error) || new Error('idb write failed')); };
      });
    });
  }
  function _stagePut(rec) { return _stageWrite(function (st) { st.put(rec); }); }
  function _stageDel(id) { return _stageWrite(function (st) { st.delete(id); }); }
  function _stageAll() {
    return _stageOpen().then(function (db) {
      return new Promise(function (res) {
        var rq = db.transaction(_STAGE_STORE, 'readonly').objectStore(_STAGE_STORE).getAll();
        rq.onsuccess = function () { try { db.close(); } catch (e) {} res(rq.result || []); };
        rq.onerror = function () { try { db.close(); } catch (e) {} res([]); };
      });
    }).catch(function () { return []; });
  }

  // One staged record. era/view are stamped as Drive appProperties after the
  // upload lands, exactly as the live paths do.
  async function _stageOne(file, name, era, view) {
    var rec = {
      id: 'stg' + Date.now() + '.' + Math.random().toString(36).slice(2, 8),
      name: name, type: (file && file.type) || 'image/jpeg', blob: file,
      era: era || '', view: view || '', at: Date.now(), tries: 0, lastErr: '',
      // v0.9.1872: a shot cropped at capture carries its ORIGINAL and box
      // (photo-crop.js _cropFirst). They ride the staged record — IndexedDB
      // keeps the bytes but not properties hung on a File — and
      // _stageReattach puts them back on the way out, so the upload keeps
      // the original exactly as an online shot would.
      orig: (file && file._rrOriginal) || null, box: (file && file._rrCropBox) || null
    };
    await _stagePut(rec);
    return rec.id;
  }
  function _stageReattach(r, f) {
    try { if (r && r.orig && f) { f._rrOriginal = r.orig; f._rrCropBox = r.box || null; } } catch (e) {}
    return f;
  }

  // The drop/picker batch, with _upload's exact era semantics: a one-shot era
  // is spent by the FIRST photo and springs back; everything else gets the
  // home era. Returns how many photos were actually saved to the device.
  async function _stageFiles(files) {
    var ts = Date.now(), n = 0;
    var spent = false;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var safe = ((f && f.name) || 'photo.jpg').replace(/[^\w.\- ]+/g, '').slice(-60);
      var name = 'INBOX ' + ts + ' g' + (ts + i) + ' ' + safe;
      var thisEra = (PIN._pinOneShot && !spent) ? PIN._pinOneShot : _pinHomeEra();
      if (i === 0 && PIN._pinOneShot) spent = true;
      try { await _stageOne(f, name, thisEra, ''); n++; }
      catch (e) { console.warn('[Inbox] could not stage ' + safe + ':', e); }
    }
    if (n && PIN._pinOneShot) { PIN._pinOneShot = null; try { _pinRenderBar(); } catch (e) {} }
    return n;
  }

  // ═══ v0.9.1600: SHOW MODE 2 — staged photos FILE ONTO ITEMS offline ═══
  //
  // Brad: "i should be able to add them to the photo inbox, then add items
  // from the photo inbox just like i was on line." A staged photo can now be
  // PAIRED — with an item he owns (picker) or with the item the wizard is
  // about to save (the pending-pair handshake with wizard-save). A paired
  // record drains STRAIGHT to the item's Drive folder via
  // driveUploadItemPhoto (proper name, no inbox detour), then fixes the
  // row's Item Photo Link cell through the same verified write the
  // photo-only save uses. Upload and link-fix are separate persisted steps:
  // a crash between them re-runs only the fix, never the upload.

  window._rrPendingStagePair = window._rrPendingStagePair || null;

  async function _stagePairSet(ids, itemNum, invId) {
    var list = await _stageAll();
    var first = true;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (ids.indexOf(r.id) === -1) continue;
      r.itemNum = String(itemNum || '');
      r.invId = String(invId || '');
      if (r.itemNum && !r.view) { r.view = first ? 'RSV' : 'EXTRA'; first = false; }
      await _stagePut(r);
    }
    try { _stageRenderStrip(); } catch (e) {}
  }

  // wizard-save calls this the moment a collection row is BUILT (before the
  // append, so an offline save — which records and answers row-unknown —
  // still pairs). Cancelling the wizard clears the pending set instead.
  window._rrStagePairCommit = function (itemNum, invId) {
    var pend = window._rrPendingStagePair;
    window._rrPendingStagePair = null;
    if (!pend || !pend.ids || !pend.ids.length || !itemNum) return;
    _stagePairSet(pend.ids, itemNum, invId).catch(function (e) {
      console.warn('[Inbox] stage pair commit:', e);
    });
  };

  // ── the staged photo's review card ───────────────────────────────
  window._stageReview = async function (id) {
    var list = await _stageAll();
    var r = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { r = list[i]; break; }
    if (!r) { try { _stageRenderStrip(); } catch (e) {} return; }
    var old = document.getElementById('stage-review-ov'); if (old) old.remove();
    var u = '';
    try { u = URL.createObjectURL(r.blob); if (u) _stageUrls.push(u); } catch (e) {}
    var ov = document.createElement('div');
    ov.id = 'stage-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100060;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;padding:max(0.8rem,env(safe-area-inset-top)) 0.9rem max(0.8rem,env(safe-area-inset-bottom))';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;color:#fff;margin-bottom:0.5rem">'
      + '<strong style="font-size:0.95rem">Photo waiting to upload</strong>'
      + '<button onclick="document.getElementById(\'stage-review-ov\').remove()" style="background:none;border:none;color:#bbb;font-size:1.5rem;line-height:1;cursor:pointer;padding:0.2rem 0.4rem">✕</button>'
      + '</div>'
      + '<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">'
      +   (u ? '<img src="' + u + '" style="max-width:100%;max-height:100%;border-radius:10px" alt="">' : '<div style="color:#888">Preview unavailable</div>')
      + '</div>'
      + (r.itemNum
          ? '<div style="color:#eee;font-size:0.85rem;text-align:center;margin-top:0.6rem">Filing to <b>' + rrEsc(r.itemNum) + '</b> when you reconnect'
            + ' <button onclick="_stageUnpair(\'' + r.id + '\')" style="margin-left:0.6rem;padding:0.3rem 0.7rem;border-radius:8px;border:1px solid #666;background:#2a2a2a;color:#eee;font-size:0.78rem;cursor:pointer">Unpair</button></div>'
          : '')
      + '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;flex-wrap:wrap">'
      +   '<button onclick="_stagePickItem(\'' + r.id + '\')" style="flex:1;min-width:9rem;padding:0.8rem;border-radius:10px;border:none;background:#2980b9;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Attach to an item I own…</button>'
      +   '<button onclick="_stageAddAsItem(\'' + r.id + '\')" style="flex:1;min-width:9rem;padding:0.8rem;border-radius:10px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Add as a new item…</button>'
      +   '<button onclick="_stageDiscard(\'' + r.id + '\')" style="flex:0 0 auto;padding:0.8rem;border-radius:10px;border:1px solid #a33;background:#2a2a2a;color:#f08080;font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Remove</button>'
      + '</div>';
    document.body.appendChild(ov);
  };

  window._stageUnpair = function (id) {
    _stagePairSet([id], '', '').then(function () {
      var ov = document.getElementById('stage-review-ov'); if (ov) ov.remove();
      window._stageReview(id);
    });
  };

  window._stageDiscard = async function (id) {
    var go = true;
    try { go = await appConfirm('Remove this waiting photo from this device? It has not been uploaded anywhere.', { title: 'Remove photo', ok: 'Remove it', cancel: 'Keep it', danger: true }); } catch (e) {}
    if (!go) return;
    try { await _stageDel(id); } catch (e) {}
    var ov = document.getElementById('stage-review-ov'); if (ov) ov.remove();
    try { _stageRenderStrip(); } catch (e) {}
  };

  window._stageAddAsItem = function (id) {
    window._rrPendingStagePair = { ids: [id], at: Date.now() };
    var ov = document.getElementById('stage-review-ov'); if (ov) ov.remove();
    if (typeof openWizard === 'function') openWizard('collection');
  };

  // ── pick an owned item to attach to ──────────────────────────────
  window._stagePickItem = function (id) {
    var old = document.getElementById('stage-pick-ov'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'stage-pick-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100070;background:var(--scrim);display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1rem;width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">'
      +   '<strong style="color:var(--text);font-size:0.95rem">Attach to which item?</strong>'
      +   '<button onclick="document.getElementById(\'stage-pick-ov\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer">✕</button>'
      + '</div>'
      + '<input id="stage-pick-q" placeholder="Type an item number or words from the name…" style="padding:0.6rem 0.7rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.9rem;margin-bottom:0.55rem">'
      + '<div id="stage-pick-list" style="flex:1;overflow-y:auto;min-height:0"></div>'
      + '</div>';
    document.body.appendChild(ov);
    var q = document.getElementById('stage-pick-q'), listEl = document.getElementById('stage-pick-list');
    function paint() {
      var term = String((q && q.value) || '').toLowerCase().trim();
      var rows = [];
      try {
        Object.keys(state.personalData || {}).forEach(function (k) {
          var r2 = state.personalData[k];
          if (!r2 || !r2.itemNum) return;
          var hay = (r2.itemNum + ' ' + (r2.masterDescription || '') + ' ' + (r2.yourDescription || '')).toLowerCase();
          if (!term || hay.indexOf(term) >= 0) rows.push(r2);
        });
      } catch (e) {}
      rows = rows.slice(0, 20);
      listEl.innerHTML = rows.length ? rows.map(function (r2) {
        var safeNum = String(r2.itemNum).replace(/[^\w.\- ]+/g, '');
        return '<div onclick="_stagePairPicked(\'' + id + '\',\'' + safeNum + '\',\'' + String(r2.inventoryId || '') + '\')"'
          + ' style="padding:0.55rem 0.4rem;border-top:1px solid var(--border);cursor:pointer">'
          + '<b style="color:var(--text);font-size:0.88rem">' + rrEsc(r2.itemNum) + '</b>'
          + ' <span style="color:var(--text-mid);font-size:0.8rem">' + rrEsc(String(r2.masterDescription || '').slice(0, 60)) + '</span></div>';
      }).join('') : '<div style="color:var(--text-dim);font-size:0.85rem;padding:0.6rem 0.2rem">Nothing matches.</div>';
    }
    if (q) q.oninput = paint;
    paint();
  };

  window._stagePairPicked = function (id, itemNum, invId) {
    _stagePairSet([id], itemNum, invId).then(function () {
      var p1 = document.getElementById('stage-pick-ov'); if (p1) p1.remove();
      var p2 = document.getElementById('stage-review-ov'); if (p2) p2.remove();
      showToast('Will file to ' + itemNum + ' when you’re back online', 3200);
    });
  };

  // ── a paired record drains straight to its item ──────────────────
  async function _stageFileToItem(r) {
    if (!r.upLink) {
      var f = r.blob;
      try { if (!f.name) f = new File([r.blob], 'photo.jpg', { type: r.type || 'image/jpeg' }); } catch (eF) {}
      _stageReattach(r, f);   // v0.9.1872: the original rides along
      var link = await driveUploadItemPhoto(f, r.itemNum, r.view || 'RSV', r.invId || undefined);
      if (!link) throw new Error('no link back from Drive');
      r.upLink = link;
      try { await _stagePut(r); } catch (e) {}   // crash-safe: never upload twice
    }
    if (!r.invId) return;                         // no row to point at — folder delivery is the job
    var pd = null;
    try {
      var ks = Object.keys(state.personalData || {});
      for (var i = 0; i < ks.length; i++) {
        var row = state.personalData[ks[i]];
        if (row && String(row.inventoryId || '') === String(r.invId)) { pd = row; break; }
      }
    } catch (e) {}
    if (!pd) throw new Error('row for ' + r.itemNum + ' not loaded yet');   // kept — retried next drain
    if (pd.photoItem) return;                     // row already has a photo link
    if (!pd.row || pd.row === 99999) throw new Error('row number for ' + r.itemNum + ' unknown yet');
    var okUp = await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row,
      PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[r.upLink]],
      { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection');
    if (okUp) pd.photoItem = r.upLink;
  }

  // ── the drain: staged → Drive, on reconnect / boot / demand ──────────
  async function _stageDrain() {
    if (_stageDraining) return;
    if (_pinOffline()) return;
    if (!_qcToken()) return;                    // wait for a signed-in token
    try {                                        // cross-tab: newest lock wins
      var lk = parseInt(localStorage.getItem(_STAGE_LOCK) || '0', 10);
      if (lk && (Date.now() - lk) < 60000) return;
      localStorage.setItem(_STAGE_LOCK, String(Date.now()));
    } catch (e) {}
    var list = await _stageAll();
    if (!list.length) { try { localStorage.removeItem(_STAGE_LOCK); } catch (e) {} return; }
    _stageDraining = true;
    var ok = 0, fail = 0, _filed = 0;
    try {
      var fid = await _folder();
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        try {
          // v0.9.1612: the pill counts photos the same way it counts saves.
          try { if (typeof rrSyncPill === 'function' && list.length) rrSyncPill('Uploading photo ' + (ok + fail + 1) + ' of ' + list.length + '\u2026', { sticky: true }); } catch (eP) {}
          // v0.9.1600: paired photos file straight to their item
          if (r.itemNum) {
            await _stageFileToItem(r);
            await _stageDel(r.id);
            ok++; _filed++;
            continue;
          }
          var up = await driveUploadFile(_stageReattach(r, r.blob), r.name, fid);   // v0.9.1872: the original rides along
          if (!up || !up.id) throw new Error('no id back from Drive');
          var meta = {};
          if (r.era) { meta.era = r.era; meta.stat = 'stamped'; }
          if (r.view) meta.view = r.view;
          // a stamp that fails must not fail the upload — same rule as _upload
          if (meta.era || meta.view) { try { await _pinMetaSet(up.id, meta); } catch (eM) {} }
          await _stageDel(r.id);                // ONLY after the confirmed ok
          ok++;
        } catch (e) {
          fail++;
          r.tries = (r.tries || 0) + 1;
          r.lastErr = String((e && e.message) || e || '');
          try { await _stagePut(r); } catch (e2) {}
          if (_pinOffline()) break;             // gone again — rest waits
        }
      }
    } catch (eOuter) { console.warn('[Inbox] stage drain:', eOuter); }
    _stageDraining = false;
    try { localStorage.removeItem(_STAGE_LOCK); } catch (e) {}
    try { await _stageRenderStrip(); } catch (e) {}
    try { if (typeof rrSyncPill === 'function') { if (ok && !fail) rrSyncPill('Photos saved \u2014 ' + ok + ' of ' + ok + ' \u2713'); else if (fail) rrSyncPill(fail + ' photo' + (fail > 1 ? 's' : '') + ' still waiting \u2014 will retry', { warn: true, holdMs: 5000 }); } } catch (eP2) {}
    if (ok) {
      // v0.9.1600: filed photos went to their ITEMS, not the inbox — say so.
      if (_filed) showToast(_filed + ' photo' + (_filed > 1 ? 's' : '') + ' filed to ' + (_filed > 1 ? 'their items' : 'its item'), 3500);
      if (ok > _filed) showToast((ok - _filed) + ' photo' + (ok - _filed > 1 ? 's' : '') + ' taken offline ' + (ok - _filed > 1 ? 'have' : 'has') + ' reached your inbox', 3500);
      try { _pinRefresh(); } catch (e) {}
    }
    if (fail && !_pinOffline()) {
      showToast(fail + ' photo' + (fail > 1 ? 's' : '') + ' from this device could not upload yet \u2014 they are kept and will retry', 4200, true);
    }
  }
  window._pinStageDrainNow = function () { _stageDrain(); };

  // ── the strip: staged photos are VISIBLE, with a waiting badge ───────
  async function _stageRenderStrip() {
    var host = document.getElementById('pin-staged');
    if (!host) return;
    var list = await _stageAll();
    _stageUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    _stageUrls = [];
    if (!list.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
    host.style.display = '';
    var thumbs = list.slice(0, 12).map(function (r) {
      var u = '';
      try { u = URL.createObjectURL(r.blob); if (u) _stageUrls.push(u); } catch (e) {}
      // v0.9.1600: tap a waiting photo to review it — attach it to an item,
      // add it as a new item, or remove it. Paired ones wear their item.
      return '<div onclick="_stageReview(\'' + r.id + '\')" style="position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1.5px solid var(--border);flex:0 0 auto;background:var(--surface2);cursor:pointer">'
        + (u ? '<img src="' + u + '" class="rr-fit" style="width:100%;height:100%" alt="">' : '')
        + (r.itemNum
            ? '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);color:#fff;font-size:0.55rem;font-weight:700;text-align:center;padding:1px 2px;white-space:nowrap;overflow:hidden">→ ' + rrEsc(r.itemNum) + '</div>'
            : '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);color:#fff;font-size:0.55rem;font-weight:700;text-align:center;padding:1px 2px">waiting</div>')
        + '</div>';
    }).join('');
    var more = list.length > 12 ? '<span style="font-size:0.75rem;color:var(--text-dim);align-self:center">+' + (list.length - 12) + ' more</span>' : '';
    host.innerHTML =
      '<div style="border:1.5px solid var(--border);border-radius:12px;background:var(--bg-card);padding:0.7rem 0.8rem;margin-top:0.8rem">'
      + '<div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap">'
      +   '<span style="font-weight:700;font-size:0.85rem;color:var(--text)">\ud83d\udcf5 ' + list.length + ' photo' + (list.length > 1 ? 's' : '') + ' waiting to upload</span>'
      +   '<span style="font-size:0.78rem;color:var(--text-dim)">' + (_pinOffline()
            ? 'Saved on this device \u2014 they\u2019ll go up on their own when you\u2019re back online.'
            : 'Saved on this device \u2014 uploading\u2026') + '</span>'
      +   (!_pinOffline() ? '<button onclick="_pinStageDrainNow()" style="padding:0.35rem 0.8rem;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card);color:var(--text-mid);font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">Upload now</button>' : '')
      + '</div>'
      + '<div style="display:flex;gap:0.5rem;overflow-x:auto;margin-top:0.6rem;padding-bottom:0.2rem">' + thumbs + more + '</div></div>';
  }

  // Reconnect + boot triggers. The offline-BOOT flavour reloads the page when
  // the connection returns (app-misc), so the boot poller is what catches
  // those; the 'online' listener catches airplane mode flipped mid-session.
  try {
    window.addEventListener('online', function () {
      setTimeout(function () { _stageDrain(); }, 1500);
      // v0.9.1602: photos filed offline (pending notes) move the minute the
      // connection returns — 4s so the row drains ahead of the mover.
      setTimeout(function () { try { _flushPending(); } catch (e) {} }, 4000);
    });
  } catch (e) {}
  var _stageBootPoll = setInterval(function () {
    if (_pinOffline()) return;
    if (!_qcToken()) return;
    clearInterval(_stageBootPoll);
    _stageDrain();
  }, 4000);

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
    // v0.9.1590: the door opens offline again — local files STAGE now.
    // Google Photos keeps its own refusal (the picker is the network).
    if (!PIN._pinSession) {
      return window._pinPickContext({
        title: 'What are you about to photograph?',
        blurb: 'Set it once and every photo in this session is stamped with it. You can switch mid-session, and Done ends it.',
        okLabel: 'Start shooting',
        cancelLabel: 'Skip \u2014 just add photos',
        onPick: function (era) {
          PIN._pinSession = true;
          _pinSetHomeEra(era);
          PIN._pinOneShot = null;
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
    rrDismissGuard(ov);   // v0.9.1785
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
    if (_pinOffline()) {
      // v0.9.1590: no connection — save the photos on the device and say so.
      // If the device store itself fails, fall back to the v1589 refusal:
      // an honest no is still better than a silent loss.
      var _stN = await _stageFiles(files);
      if (_stN) {
        showToast('You\u2019re offline \u2014 ' + _stN + ' photo' + (_stN > 1 ? 's' : '') + ' saved on this device. '
          + (_stN > 1 ? 'They\u2019ll' : 'It\u2019ll') + ' upload on their own when you reconnect.', 5000);
      } else {
        showToast('You\u2019re offline and the photos could not be saved on this device \u2014 reconnect and add them again.', 5000, true);
      }
      try { await _stageRenderStrip(); } catch (e) {}
      return;
    }
    if (PIN._busy) { _pinBusyBounce(); return; }
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
        var _thisEra = (PIN._pinOneShot && !_spentOneShot) ? PIN._pinOneShot : _pinHomeEra();
        if (i === 0 && PIN._pinOneShot) _spentOneShot = true;
        if (_thisEra && up && up.id) {
          // A stamp that fails to save must not fail the upload — the photo is
          // safely in the inbox either way, it just knows less.
          await _pinMetaSet(up.id, { era: _thisEra, stat: 'stamped' });
        }
      }
      if (PIN._pinOneShot) { PIN._pinOneShot = null; _pinRenderBar(); }
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
})();
