// ══════════════════════════════════════════════════════════════
//  drive.js — Google Drive API Layer, Photo Views, Config
//  Extracted from app.js (Session 63)
//
//  Dependencies (globals from app.js, loaded before this file):
//    accessToken, tokenClient, state, onTokenReceived
//
//  Exports (global constants):
//    ITEM_VIEWS, ERROR_VIEWS, BOX_VIEWS, driveCache, _blobCache,
//    CONFIG_FILENAME
//
//  Exports (global functions):
//    getItemLabel, driveRequest, driveUploadFile,
//    driveFindOrCreateFolder, driveUploadPhoto,
//    driveMoveFileToFolder, driveSetupVault, driveEnsureSetup,
//    driveEnsureItemFolder, driveGetFolderPhotos, loadDriveThumb,
//    driveFolderLink, driveUploadItemPhoto, driveMoveToSold,
//    driveReadConfig, driveFindPersonalSheet, driveWriteConfig,
//    driveMoveSheetToVault
// ══════════════════════════════════════════════════════════════

// ── GOOGLE DRIVE HELPERS ────────────────────────────────────────

// Orthographic projection order: TOP, LEFT, FRONT, RIGHT, BACK, BOTTOM
// Grid positions: [TOP=col2], [LEFT=col1, FRONT=col2, RIGHT=col3, BACK=col4], [BOTTOM=col2]
const ITEM_VIEWS = [
  { key: 'TV',  label: 'Top View',        abbr: 'Top',        ortho: 'top'   },
  { key: 'LSV', label: 'Left Side View',  abbr: 'Left Side',  ortho: 'left'  },
  { key: 'FV',  label: 'Front View',      abbr: 'Front',      ortho: 'front' },
  { key: 'RSV', label: 'Right Side View', abbr: 'Right Side', ortho: 'right' },
  { key: 'BKV', label: 'Back View',       abbr: 'Back',       ortho: 'back'  },
  { key: 'BV',  label: 'Bottom View',     abbr: 'Bottom',     ortho: 'bottom'},
];
// Error car close-up photo views
const ERROR_VIEWS = [
  { key: 'ERR-1', label: 'Error Close-up 1', abbr: 'ERR-1' },
  { key: 'ERR-2', label: 'Error Close-up 2', abbr: 'ERR-2' },
  { key: 'ERR-3', label: 'Error Close-up 3', abbr: 'ERR-3' },
  { key: 'ERR-4', label: 'Error Close-up 4', abbr: 'ERR-4' },
];

// Returns a human-friendly label for the item type (for wizard questions)
// Bugfix 2026-04-14: was using state.masterData.find() which returned the FIRST
// match for the item number — could pick an unrelated tab (e.g. "Box") or a stray
// catalog row with the wrong itemType. Now we (a) filter to non-Box rows, (b) prefer
// the row whose variation matches d.variation when one is provided, and (c) fall
// back to whatever non-Box row we have.
function getItemLabel(d) {
  const rawNum = (d.itemNum || '').trim();
  const itemNum = rawNum.replace(/-[PD]$/, '');
  const want = (d.variation || '').toString();
  const candidates = state.masterData.filter(m =>
    (m.itemNum === itemNum || m.itemNum === rawNum) &&
    !((m.itemType || '').toLowerCase() === 'box')
  );
  let master = null;
  if (want) {
    master = candidates.find(m => (m.variation || '').toString() === want);
  }
  if (!master) master = candidates[0];
  if (!master) {
    // Last-resort fallback to the original any-row lookup
    master = state.masterData.find(m => m.itemNum === itemNum || m.itemNum === rawNum);
  }
  const t = (master && master.itemType) ? master.itemType.toLowerCase() : '';
  if (t.includes('steam') || t.includes('diesel') || t.includes('electric')) return 'locomotive';
  if (t.includes('freight') || t.includes('car')) return 'car';
  if (t.includes('passenger')) return 'car';
  if (t.includes('accessory') || t.includes('accessories')) return 'accessory';
  if (t.includes('track')) return 'track section';
  if (t.includes('set')) return 'set';
  return 'item';
}

const BOX_VIEWS = [
  { key: 'BOX-TV',  label: 'Box Top',        abbr: 'Top',        ortho: 'top'   },
  { key: 'BOX-LSV', label: 'Box Left Side',  abbr: 'Left Side',  ortho: 'left'  },
  { key: 'BOX-FV',  label: 'Box Front',      abbr: 'Front',      ortho: 'front' },
  { key: 'BOX-RSV', label: 'Box Right Side', abbr: 'Right Side', ortho: 'right' },
  { key: 'BOX-BKV', label: 'Box Back',       abbr: 'Back',       ortho: 'back'  },
  { key: 'BOX-BV',  label: 'Box Bottom',     abbr: 'Bottom',     ortho: 'bottom'},
];

// Folder structure:
//  My Collection App - Drive Folder/         (vault root — stores sheet + photo subfolders)
//    My Collection Photos/               (item photo folders)
//      726/
//        726 FV.jpg, 726 RSV.jpg ...
//    My Sold Collection Photos/          (sold item photo folders — moved here on sale)

const driveCache = {
  vaultId: null,       // "My Collection App - Drive Folder" root
  photosId: null,      // "My Collection Photos"
  catalogsId: localStorage.getItem('lv_catalogs_id') || null,
  isPhotosId: localStorage.getItem('lv_is_id') || null,
  soldPhotosId: null,  // "My Sold Collection Photos"
  itemFolders: {},     // itemNum -> folderId
};

// v0.9.1266 (audit 2026-08-02 round 2, finding R2). The three folder ids as
// best we currently know them: the in-memory cache first, then the note the
// last successful setup left in localStorage. driveCache seeds only catalogsId
// and isPhotosId at declaration, so early in a session these three are null in
// memory while localStorage still knows them perfectly well.
//
// Callers of driveWriteConfig use this so a config write never goes out
// knowing only the spreadsheet id. driveWriteConfig merges and would preserve
// them anyway — this is the belt to that pair of braces, and it keeps the
// "what do we know" question answered in ONE place instead of at each caller.
function driveKnownFolderIds() {
  return {
    vaultId:      driveCache.vaultId      || localStorage.getItem('lv_vault_id')       || null,
    photosId:     driveCache.photosId     || localStorage.getItem('lv_photos_id')      || null,
    soldPhotosId: driveCache.soldPhotosId || localStorage.getItem('lv_sold_photos_id') || null,
  };
}

async function driveRequest(method, endpoint, body) {
  if (!accessToken) {
    // Try restore from localStorage
    var saved = localStorage.getItem('lv_token');
    var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (saved && expiry > Date.now()) accessToken = saved;
    else throw new Error('Not signed in');
  }
  var res = await fetch('https://www.googleapis.com/drive/v3' + endpoint, {
    method: method,
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // If 401 (expired token), try one silent refresh and retry
  if (res.status === 401 && state.user) {
    console.warn('[Drive] 401 — attempting token refresh');
    try {
      await new Promise(function(resolve, reject) {
        var _origCb = tokenClient.callback;
        var _done = false;
        tokenClient.callback = function(resp) {
          if (_done) return;
          _done = true;
          tokenClient.callback = _origCb;
          if (resp.error) { reject(new Error(resp.error)); return; }
          onTokenReceived(resp);
          resolve();
        };
        tokenClient.requestAccessToken({ prompt: '', login_hint: state.user.email || '' });
        setTimeout(function() { if (!_done) { _done = true; tokenClient.callback = _origCb; reject(new Error('Token refresh timeout')); } }, 10000);
      });
    } catch(e) {
      console.error('[Drive] Token refresh failed:', e);
      throw new Error('Session expired — please sign in again');
    }
    // Retry with fresh token
    res = await fetch('https://www.googleapis.com/drive/v3' + endpoint, {
      method: method,
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
  // v0.9.1261 (audit 2026-08-02, finding 2). This used to throw only on 5xx.
  // A 4xx — no permission, folder deleted, quota, a bad id — was logged to a
  // console nobody has open and then RETURNED, as Google's error envelope
  // { error: { code, message } }. Callers read `res.files`, got undefined, and
  // every one of them read that as a truthful, successful "there is nothing
  // there". Two places then created a second copy of something that already
  // existed (the vault folder at driveSetupVault, the config file at
  // driveWriteConfig), and several told the user a job had finished when it
  // had not: "12 photos tagged" for zero writes, "Discarded N photos" for
  // photos still sitting in the inbox.
  //
  // A failed request now raises. Callers that genuinely want to shrug already
  // sit inside try/catch — the "does this still exist?" probes were written
  // expecting a throw and have been catching one all along.
  if (!res.ok) {
    var errText = await res.text().catch(function () { return ''; });
    var errMsg = '';
    try { errMsg = (JSON.parse(errText).error || {}).message || ''; } catch (e) {}
    console.error('[Drive] API', res.status, method, endpoint, errText);
    var err = new Error('Drive request failed (' + res.status + ')' + (errMsg ? ': ' + errMsg : ''));
    err.status = res.status;          // so callers can tell "denied" from "try again"
    throw err;
  }
  // A successful DELETE answers 204 with an EMPTY body, and res.json() on an
  // empty body rejects with "Unexpected end of JSON input" — so a DELETE that
  // worked was reported to the user as a failure. (sell.js quietly worked
  // around this years ago with its own hand-rolled _sellRawDelete, which is
  // the tell.) v0.9.1263 moved backupDelete off the bare DELETE and onto
  // PATCH {trashed:true}, so it no longer depends on this line — but the line
  // stays, because any DELETE that arrives here later needs it.
  if (res.status === 204) return {};
  var text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function driveUploadFile(file, name, folderId) {
  if (!folderId) throw new Error('Missing folderId for upload: ' + name);
  if (!accessToken) {
    var _s = localStorage.getItem('lv_token');
    var _e = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (_s && _e > Date.now()) { accessToken = _s; }
    else throw new Error('Not signed in — please sign in and try again');
  }
  const metadata = { name, parents: [folderId], mimeType: file.type };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    console.error('[Drive] Upload failed:', res.status, errText);
    throw new Error('Photo upload failed (HTTP ' + res.status + ')');
  }
  return res.json();
}

// v0.9.1286 (audit round 3, finding R3-1 — PROVEN by running the real
// function): two concurrent calls for the same name both searched, both saw
// nothing, and both created — two folders with one name, and photos split
// between them from then on (Drive allows duplicate names, so nothing ever
// complains). Two rapid adds, or a detail page resolving a folder while a
// photo add does the same, is all it takes. In-flight memoisation: the
// second caller awaits the first's promise, so one search, one create,
// one folder. A rejected promise clears the slot, so a retry starts fresh.
const _folderInflight = {};
async function driveFindOrCreateFolder(name, parentId) {
  if (!parentId) throw new Error('Missing parentId for folder: ' + name);
  const _fk = parentId + '|' + name;
  if (_folderInflight[_fk]) return _folderInflight[_fk];
  const _fp = _driveFindOrCreateFolderNow(name, parentId);
  _folderInflight[_fk] = _fp;
  try { return await _fp; } finally { delete _folderInflight[_fk]; }
}
async function _driveFindOrCreateFolderNow(name, parentId) {
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&spaces=drive`);
  // v0.9.1261: the `if (res.error)` check that used to be here is gone.
  // driveRequest raises now, so a failed search never reaches this line.
  if (res.files && res.files.length > 0) return res.files[0].id;
  const created = await driveRequest('POST', '/files?fields=id', {
    name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId],
  });
  if (!created || !created.id) {
    console.error('[Drive] Folder create failed:', name, created);
    throw new Error('Could not create Drive folder: ' + name);
  }
  return created.id;
}

async function driveUploadPhoto(file, fileName, folderId) {
  const meta = JSON.stringify({ name: fileName, parents: [folderId] });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file', file);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  // v0.9.1040: this check was missing while its sibling driveUploadFile (above)
  // has always had it. Without it a Drive error — expired token, quota, a bad
  // folder id — came back as a perfectly ordinary resolved promise, so every
  // .catch() around a photo upload never fired and the item still reported
  // "saved" with the photo nowhere on Drive.
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    console.error('[Drive] Photo upload failed:', res.status, errText);
    throw new Error('Photo upload failed (HTTP ' + res.status + ')');
  }
  return res.json();
}

async function driveMoveFileToFolder(fileId, fromFolderId, toFolderId) {
  await driveRequest('PATCH', `/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}&fields=id`, {});
}

// Called once on first run — creates the full vault folder structure
const _NEW_VAULT_NAME = 'The Rail Roster - My Collection';
const _OLD_VAULT_NAME = 'The Boxcar Files - My Collection';

async function driveSetupVault() {
  // Search for new name first, then fall back to old name
  let vaultId = null;
  // Try new name
  const qNew = encodeURIComponent(`name='${_NEW_VAULT_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
  const resNew = await driveRequest('GET', `/files?q=${qNew}&fields=files(id,name)&spaces=drive`);
  if (resNew.files && resNew.files.length > 0) {
    vaultId = resNew.files[0].id;
  }
  // Fall back to old name
  if (!vaultId) {
    const qOld = encodeURIComponent(`name='${_OLD_VAULT_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
    const resOld = await driveRequest('GET', `/files?q=${qOld}&fields=files(id,name)&spaces=drive`);
    if (resOld.files && resOld.files.length > 0) {
      vaultId = resOld.files[0].id;
      // Rename old folder to new name
      console.log('[Drive] Renaming vault folder:', _OLD_VAULT_NAME, '→', _NEW_VAULT_NAME);
      try {
        await driveRequest('PATCH', `/files/${vaultId}?fields=id`, { name: _NEW_VAULT_NAME });
      } catch(e) { console.warn('[Drive] Folder rename failed (non-fatal):', e); }
    }
  }
  // Create if neither exists
  if (!vaultId) {
    vaultId = await driveFindOrCreateFolder(_NEW_VAULT_NAME, 'root');
  }

  driveCache.vaultId = vaultId;
  localStorage.setItem('lv_vault_id', driveCache.vaultId);

  // Find or create both photo subfolders (always, so nothing is missing)
  driveCache.photosId     = await driveFindOrCreateFolder('My Collection Photos',      driveCache.vaultId);
  driveCache.soldPhotosId = await driveFindOrCreateFolder('My Sold Collection Photos', driveCache.vaultId);
  localStorage.setItem('lv_photos_id',      driveCache.photosId);
  localStorage.setItem('lv_sold_photos_id', driveCache.soldPhotosId);

  // Move the personal sheet into the vault folder if we have its ID
  const sheetId = localStorage.getItem('lv_personal_id');
  if (sheetId) {
    try { await driveMoveSheetToVault(sheetId); } catch(e) { console.warn('Sheet move:', e); }
  }

  // Save config so other devices can discover these IDs
  if (state.personalSheetId) {
    driveWriteConfig({
      personalSheetId: state.personalSheetId,
      vaultId: driveCache.vaultId,
      photosId: driveCache.photosId,
      soldPhotosId: driveCache.soldPhotosId,
    }).catch(e => console.warn('Config write:', e));
  }
  return driveCache.vaultId;
}

async function driveEnsureSetup() {
  // If cache is populated AND already validated this session, trust it
  if (driveCache.vaultId && driveCache.photosId && driveCache.soldPhotosId && driveCache._validated) return;
  // If cache is populated but not yet validated, check the folder exists
  if (driveCache.vaultId && driveCache.photosId && driveCache.soldPhotosId) {
    try {
      var _vc = await driveRequest('GET', '/files/' + driveCache.photosId + '?fields=id,trashed');
      if (_vc && _vc.id && !_vc.trashed) { driveCache._validated = true; return; }
    } catch(e) { /* validation failed, fall through */ }
    // Cache looks stale — rediscover. v0.9.1261 (audit 2026-08-02, finding 2):
    // the ids used to be erased HERE, before the rediscovery that replaces
    // them. That was survivable only because a failed rediscovery used to
    // "succeed" by creating an empty duplicate vault; now it can genuinely
    // raise, and erasing first would turn one refused request into a user with
    // no idea where their own photo folders are. driveSetupVault searches Drive
    // by name from scratch and overwrites every one of these on the way out, so
    // there is nothing to clear first — only itemFolders, whose entries point
    // into the old layout, and that is cleared once the new layout is known.
    console.warn('[Drive] Cached photosId stale/invalid, re-running setup');
    await driveSetupVault();
    driveCache.itemFolders = {};
    driveCache._validated = true;
    return;
  }
  // Try from localStorage (fast path)
  const vId = localStorage.getItem('lv_vault_id');
  const pId = localStorage.getItem('lv_photos_id');
  const sId = localStorage.getItem('lv_sold_photos_id');
  if (vId && pId && sId) {
    // Quick-validate that the photos folder still exists
    try {
      const check = await driveRequest('GET', '/files/' + pId + '?fields=id,trashed');
      if (check && check.id && !check.trashed) {
        driveCache.vaultId      = vId;
        driveCache.photosId     = pId;
        driveCache.soldPhotosId = sId;
        driveCache._validated   = true;
        return;
      }
    } catch(e) { /* fall through to full setup */ }
    // Cached IDs look stale — rediscover. Same reasoning as above: the three
    // removeItem calls that used to sit here erased the only note of where the
    // user's folders are, before knowing whether anything could replace it.
    // driveSetupVault writes all three itself.
    console.warn('[Drive] localStorage folder IDs stale, re-running setup');
  }
  // Always run full setup so any missing folders get created
  await driveSetupVault();
  driveCache._validated = true;
}

// ══ v0.9.1125 — item photos file under their era ═══════════════════════════
// Brad: "i thought we had made a filing system so the pictures are in folders
// starting with era, then manufacturer, and then the item number. to help the
// user find their photo once they unsubscribe."
//
// It was designed in Session 180 and never built — every item folder sat flat
// under "My Collection Photos". Now they nest one level down, under the era's
// own label: "Lionel Postwar / 2328". ONE level, not three, because in this
// app maker + era + scale are a single stored fact (`pw` IS Lionel Postwar O,
// `mth_ho` IS MTH HO modern) — splitting one field across three folder levels
// would create levels that can never disagree with each other.
//
// THE ORDER MATTERS: this finder ships BEFORE anything is migrated. It looks
// for an item's folder in the root AND in every era folder, so a folder that
// has been moved is still found, and an item can never end up with its photos
// split across two folders.

// The era subfolders that actually exist under "My Collection Photos".
// Cached per session; refreshed whenever we create a new one.
//
// v0.9.1264 (audit 2026-08-02 round 2, finding R6): this used to wrap the whole
// scan in `catch (e) { console.warn(...) }` and then cache whatever it had —
// which, after a failure, was an EMPTY map, for the rest of the session. Two
// harms followed from that one line, and the second is the expensive one:
//
//   1. _driveItemFolderAnywhere searches the root plus every era folder in this
//      map. With the map empty it searches the root only, misses a folder that
//      lives under an era, and reports "no folder exists".
//   2. Its caller then CREATES one. The item's photos are now split across two
//      folders with the same name in different parents — the exact duplicate
//      the era-folder finder was written to prevent, caused by the failure
//      handling rather than by the logic.
//
// A refused scan is not an empty Drive. It raises now, and nothing is cached,
// so the next call tries again instead of being answered from a failure.
let _driveEraFolderCache = null;
async function _driveEraFolders(force) {
  if (_driveEraFolderCache && !force) return _driveEraFolderCache;
  const out = {};
  if (!driveCache.photosId) return (_driveEraFolderCache = out);   // no photos folder yet: genuinely empty
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + driveCache.photosId + "' in parents and trashed=false");
  const res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name)&pageSize=200');
  const labels = {};
  try {
    Object.keys(ERAS).forEach(function (k) {
      if (ERAS[k] && ERAS[k].label && k !== 'all') labels[ERAS[k].label] = k;
    });
  } catch (e) {}   // ERAS missing is a load-order problem, not a Drive failure — an unlabelled scan is still a real answer
  (res.files || []).forEach(function (f) { if (labels[f.name]) out[f.name] = f.id; });
  return (_driveEraFolderCache = out);
}

// The folder NAME an item's photos belong under, or '' when we cannot tell.
// Unknown era is not a guess-worthy situation — the folder simply stays at the
// top level, exactly where it lives today.
function driveEraFolderNameFor(itemNum, eraHint) {
  function lab(k) {
    try { return (k && k !== 'all' && ERAS[k] && ERAS[k].label) ? ERAS[k].label : ''; } catch (e) { return ''; }
  }
  if (eraHint) { const l = lab(eraHint); if (l) return l; }
  const n = String(itemNum || '').trim();
  if (!n) return '';
  // What the user already owns is the most trustworthy answer.
  try {
    const pds = Object.values((window.state || {}).personalData || {});
    const own = pds.find(function (p) { return p && p.owned && String(p.itemNum) === n && p.era; });
    if (own) {
      if (String(own.era) === 'Manual') return '';        // a manual entry has no catalog era
      const l = lab(own.era); if (l) return l;
    }
    // v0.9.1126 — an AA/ABA pair's photos live in a folder named for the BASE
    // number (204) while the owned rows carry suffixes (204-P, 204-D). Without
    // this bridge the bare number finds no owner, falls through to the catalog
    // and hits the PREWAR 204 — landing a postwar Alco in Lionel Pre-War. Same
    // "a number is not an identity" trap as Brad's 213.
    const based = pds.find(function (p) {
      return p && p.owned && p.era && typeof baseItemNum === 'function'
        && String(p.itemNum) !== n && baseItemNum(String(p.itemNum)) === n;
    });
    if (based) {
      if (String(based.era) === 'Manual') return '';
      const l2 = lab(based.era); if (l2) return l2;
    }
  } catch (e) {}
  // Then the catalog.
  try {
    if (typeof findMaster === 'function') {
      const m = findMaster(n);
      if (m && m._era) { const l = lab(m._era); if (l) return l; }
    }
  } catch (e) {}
  return '';
}

// Find an item's folder wherever it currently lives — root or any era folder.
// This is what makes the migration safe: nothing is looked up by its old path.
// v0.9.1272 (audit 2026-08-02 round 2, finding R13): "anywhere" used to mean
// "anywhere THIS DEVICE has heard of", and the two are not the same thing.
//
// The parent list is built from _driveEraFolders(), which is cached for the
// session. Item folders live one level down, under an era. So if the desktop
// files 213 under "Lionel Pre-War" and the phone loaded before that era folder
// existed, the phone searches the root plus the eras it knew at startup, does
// not look inside Pre-War, and comes back null. null here means "no folder
// exists", so driveEnsureItemFolder creates one — under whatever era THAT
// device works out, which need not be the same answer: the desktop knows the
// user owns 213 as Pre-War, while a phone that has not reloaded its personal
// data falls through to the catalog. Result: two folders named 213 in
// different parents, and the phone's photos never appear on the desktop.
//
// Measured against a stand-in Drive, both halves are needed to do damage. A
// stale era list ALONE is harmless — driveFindOrCreateFolder asks Drive live
// before it creates anything, so it lands on the existing folder. It only
// bites when the stale list hides the folder AND this device would file it
// somewhere else.
//
// So the fix is here rather than in the era guess: a miss re-reads the era
// folders once and looks again before anyone concludes the folder is absent.
// The re-read costs one request, and only on the path that was about to spend
// two creating folders, so nothing in ordinary use gets slower. The second
// SEARCH is skipped entirely when the re-read turned up the same parents.
//
// The refresh is deliberately NOT wrapped in a try/catch. R6's whole lesson
// was that a swallowed Drive failure reads as "nothing there" and creates the
// duplicate. A refusal raises, the caller reports a retryable failure, and no
// second home gets made.
async function _driveItemFolderAnywhere(itemNum) {
  const name = String(itemNum || '').trim();
  if (!name || !driveCache.photosId) return null;

  const parentsOf = function (eras) {
    return [driveCache.photosId].concat(Object.keys(eras).map(function (k) { return eras[k]; }));
  };
  const lookIn = async function (parents) {
    const parentQ = parents.map(function (p) { return "'" + p + "' in parents"; }).join(' or ');
    const q = encodeURIComponent("name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and (" + parentQ + ")");
    const res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name,parents)&spaces=drive');
    const hit = res && res.files && res.files[0];
    return hit ? hit.id : null;
  };

  const known = parentsOf(await _driveEraFolders());
  const first = await lookIn(known);
  if (first) return first;

  // Nothing found in the folders this device knew about. Before letting that
  // read as "no folder exists", find out whether another device has made one
  // since. The forced re-read also replaces the session cache, so step 2 of
  // driveEnsureItemFolder files into the same era folder rather than a copy.
  const fresh = parentsOf(await _driveEraFolders(true));
  const same = fresh.length === known.length &&
               fresh.slice().sort().join('|') === known.slice().sort().join('|');
  if (same) return null;                 // genuinely absent — nothing new to search
  return await lookIn(fresh);
}

async function driveEnsureItemFolder(itemNum, eraHint) {
  await driveEnsureSetup();
  const key = String(itemNum);
  if (driveCache.itemFolders[key]) return driveCache.itemFolders[key];
  // 1. Already exists somewhere? Use it — never create a second home.
  //
  // v0.9.1264 (finding R6): this line used to be
  //   try { folderId = await _driveItemFolderAnywhere(key); } catch (e) {}
  // which turned every failure into `null`, and `null` here means "no folder
  // exists" — so the next block created one. v0.9.1261 taught driveRequest to
  // raise precisely so that a refusal would stop reading as "nothing there";
  // this catch handed the raise straight back to null, one level down, and
  // re-created the duplicate-folder bug that motivated the whole fix.
  //
  // There is no swallow here now. _driveItemFolderAnywhere returns null ONLY
  // when the search ran and found nothing — the one case where creating a
  // folder is the right answer. Anything else raises, and the callers (all six
  // of them, checked) already handle that: the photo upload reports a failure
  // the user can retry, instead of quietly filing into a second home.
  let folderId = await _driveItemFolderAnywhere(key);
  // 2. Otherwise create it under its era, or at the top level if unknown.
  if (!folderId) {
    let parentId = driveCache.photosId;
    try {
      const eraName = driveEraFolderNameFor(key, eraHint);
      if (eraName) {
        const eras = await _driveEraFolders();
        if (!eras[eraName]) {
          eras[eraName] = await driveFindOrCreateFolder(eraName, driveCache.photosId);
          _driveEraFolderCache = eras;
        }
        parentId = eras[eraName];
      }
      // This catch stays, and is NOT the one R6 was about. Reaching here means
      // step 1 already ran successfully and established that no folder for this
      // item exists anywhere — so a failure to work out or create the ERA
      // folder costs tidiness (the folder lands at the top level, where every
      // folder used to live) and cannot produce a second home for the photos.
    } catch (e) { console.warn('[Drive] era folder:', e && e.message); }   // fall back to the root
    folderId = await driveFindOrCreateFolder(key, parentId);
  }
  driveCache.itemFolders[key] = folderId;
  return folderId;
}

// ── v0.9.1123 (Brad: "several pictures are not showing up on thumbnails
// that are on the detail sheets") ─────────────────────────────────────────
// Find an item's photo folder WITHOUT creating one. The detail page already
// falls back to the item's folder when the sheet's photo-link cell is blank —
// that is exactly why a photo shows there and not in the list. The list needs
// the same fallback, but it runs over a whole page of rows at once, so it must
// never use the create-if-missing lookup: that would litter Drive with an
// empty folder for every photoless item on screen. Returns a folder LINK (the
// same shape the sheet stores) or '' when no folder exists yet.
async function driveFindItemFolder(itemNum) {
  try {
    const name = String(itemNum || '').trim();
    if (!name || !accessToken) return '';
    await driveEnsureSetup();
    if (driveCache.itemFolders[name]) return driveFolderLink(driveCache.itemFolders[name]);
    if (!driveCache.photosId) return '';
    // v0.9.1125: searches the root AND every era folder, so a migrated folder
    // is still found. Still find-only — it never creates anything.
    const id = await _driveItemFolderAnywhere(name);
    if (!id) return '';
    driveCache.itemFolders[name] = id;
    return driveFolderLink(id);
  } catch (e) { console.warn('[Drive] item folder lookup:', itemNum, e && e.message); return ''; }
}
if (typeof window !== 'undefined') window.driveFindItemFolder = driveFindItemFolder;

// v0.9.1197 — THE one answer to "where do this item's photos live?"
// The 07-30 audit found this question answered in FOUR places (desktop list,
// phone list / dashboard reel, detail page, camera-icon pass), each with its
// own copy of "sheet cell, else search Drive" — and they drifted: v0.9.1123
// hardened three of them while its comments claimed, in two files, that the
// detail page already had the fallback. It didn't, and that false parity hid
// the row-99999 write regression from the one page Brad opens to look at a
// photo. One resolver, called by every surface: the sheet's stored link when
// present, otherwise a find-only Drive search (never creates a folder), '' on
// any failure. If a fifth surface ever needs photos, it calls this.
async function rrPhotoFolderFor(pd, itemNumOverride) {
  try {
    var link = pd && pd.photoItem;
    if (link) return link;
    var num = String(itemNumOverride || (pd && pd.itemNum) || '').trim();
    if (!num) return '';
    return (await driveFindItemFolder(num)) || '';
  } catch (e) { return ''; }
}
if (typeof window !== 'undefined') window.rrPhotoFolderFor = rrPhotoFolderFor;

// ── v0.9.1125 — one-time migration of the existing flat item folders ───────
// Moves each top-level item folder under its era's folder. Safe because:
//   · a folder KEEPS ITS ID when it moves, so every photoItem link in the
//     sheet still resolves — nothing to rewrite, nothing to break;
//   · the finder above already looks in both places, so a half-finished run
//     leaves the app working exactly as well as a finished one;
//   · an item whose era cannot be determined is LEFT ALONE, not guessed at;
//   · re-running it is a no-op for anything already moved.
// dryRun:true reports the plan and touches nothing.
async function driveMigrateItemFoldersToEras(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};
  await driveEnsureSetup();
  if (!driveCache.photosId) throw new Error('Photos folder not ready');

  // Every folder sitting at the top level right now.
  // v0.9.1261 (audit 2026-08-02, finding 2): this listing decides what gets
  // migrated, so a page that fails to arrive is not a detail — it is a set of
  // folders that will silently never be moved. Before driveRequest raised, a
  // 4xx on page 2 left res.files undefined and res.nextPageToken undefined, so
  // the loop simply ended and the run reported a tidy, complete-looking
  // success over half the data. It now records that the listing is incomplete
  // and says so in the result, the same way _pinRefresh does with
  // _pinListComplete. A partial run is still safe to do — every move is
  // idempotent and ids never change — but the caller deserves to know.
  const kids = [];
  let pageToken = '', listComplete = true, guard = 0;
  do {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + driveCache.photosId + "' in parents and trashed=false");
    let res;
    try {
      res = await driveRequest('GET', '/files?q=' + q + '&fields=nextPageToken,files(id,name)&pageSize=200' + (pageToken ? '&pageToken=' + pageToken : ''));
    } catch (e) {
      console.warn('[Drive] folder listing stopped early:', e);
      listComplete = false; break;
    }
    (res.files || []).forEach(function (f) { kids.push(f); });
    pageToken = (res && res.nextPageToken) || '';
    if (++guard > 40) { listComplete = false; break; }   // never spin forever
  } while (pageToken);

  // Anything already named after an era is a destination, not a thing to move.
  const eraLabels = {};
  try {
    Object.keys(ERAS).forEach(function (k) {
      if (ERAS[k] && ERAS[k].label && k !== 'all') eraLabels[ERAS[k].label] = k;
    });
  } catch (e) {}

  const plan = [], skipped = [];
  kids.forEach(function (f) {
    if (eraLabels[f.name]) return;                       // an era folder itself
    const era = driveEraFolderNameFor(f.name, '');
    if (!era) { skipped.push({ name: f.name, why: 'era unknown — left at the top level' }); return; }
    plan.push({ id: f.id, name: f.name, era: era });
  });

  const result = { total: kids.length, planned: plan.length, skipped: skipped,
                   moved: 0, failed: [], dryRun: dryRun, byEra: {},
                   listComplete: listComplete };
  if (!listComplete) result.warning = 'Drive stopped listing folders partway — this run covers only what was read. Re-run it; moves already made are not repeated.';
  plan.forEach(function (p) { result.byEra[p.era] = (result.byEra[p.era] || 0) + 1; });
  if (dryRun) return result;

  const eras = await _driveEraFolders(true);
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    try {
      if (!eras[p.era]) {
        eras[p.era] = await driveFindOrCreateFolder(p.era, driveCache.photosId);
        _driveEraFolderCache = eras;
      }
      // addParents/removeParents is a MOVE — the folder id is unchanged, so
      // every stored link keeps working.
      await driveRequest('PATCH', '/files/' + p.id + '?addParents=' + eras[p.era] +
                                  '&removeParents=' + driveCache.photosId + '&fields=id');
      driveCache.itemFolders[p.name] = p.id;
      result.moved++;
    } catch (e) {
      result.failed.push({ name: p.name, era: p.era, error: (e && e.message) || String(e) });
    }
    onProgress(i + 1, plan.length, p.name);
  }
  _driveEraFolderCache = null;                            // rescan next time
  return result;
}
// v0.9.1126 — corrective pass. The migration only ever looks at TOP-LEVEL
// folders, so once something is filed it stays put even if the era rule later
// improves. This re-checks every item folder ALREADY inside an era folder and
// moves the ones now known to be in the wrong place. Same safety properties:
// ids never change, an undeterminable era is left alone, failures don't abort.
async function driveRefileItemFolders(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  await driveEnsureSetup();
  const eras = await _driveEraFolders(true);
  const names = Object.keys(eras);
  const wrong = [];
  // v0.9.1261 (audit 2026-08-02, finding 2): same reasoning as the migration
  // above, with one addition — this loop runs once PER ERA, so a raised error
  // left unhandled here would abandon every era after the one that failed. A
  // failure inside one era is recorded and the rest are still checked.
  let listComplete = true;
  const incomplete = [];
  for (let i = 0; i < names.length; i++) {
    const eraName = names[i], eraId = eras[eraName];
    let pageToken = '', guard = 0;
    do {
      const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + eraId + "' in parents and trashed=false");
      let res;
      try {
        res = await driveRequest('GET', '/files?q=' + q + '&fields=nextPageToken,files(id,name)&pageSize=200' + (pageToken ? '&pageToken=' + pageToken : ''));
      } catch (e) {
        console.warn('[Drive] listing stopped early inside era:', eraName, e);
        listComplete = false; incomplete.push(eraName); break;
      }
      (res.files || []).forEach(function (f) {
        const should = driveEraFolderNameFor(f.name, '');
        if (should && should !== eraName) wrong.push({ id: f.id, name: f.name, from: eraName, to: should });
      });
      pageToken = (res && res.nextPageToken) || '';
      if (++guard > 40) { listComplete = false; incomplete.push(eraName); break; }
    } while (pageToken);
  }
  const result = { checked: names.length, wrong: wrong.length, moved: 0, failed: [], dryRun: dryRun, list: wrong,
                   listComplete: listComplete, incompleteEras: incomplete };
  if (!listComplete) result.warning = 'Some eras were not fully read (' + incomplete.join(', ') + '). Re-run to finish; moves already made are not repeated.';
  if (dryRun) return result;
  for (let j = 0; j < wrong.length; j++) {
    const w = wrong[j];
    try {
      if (!eras[w.to]) { eras[w.to] = await driveFindOrCreateFolder(w.to, driveCache.photosId); _driveEraFolderCache = eras; }
      await driveRequest('PATCH', '/files/' + w.id + '?addParents=' + eras[w.to] +
                                  '&removeParents=' + eras[w.from] + '&fields=id');
      result.moved++;
    } catch (e) { result.failed.push({ name: w.name, error: (e && e.message) || String(e) }); }
  }
  _driveEraFolderCache = null;
  return result;
}

if (typeof window !== 'undefined') {
  window.driveMigrateItemFoldersToEras = driveMigrateItemFoldersToEras;
  window.driveRefileItemFolders = driveRefileItemFolders;
  window.driveEraFolderNameFor = driveEraFolderNameFor;
}

// ── v0.9.1128 — reconnect photos that were uploaded but never linked ───────
// Until v0.9.1127 the tender / B-unit / second-A-unit and their box rows were
// saved with a blank photo link, so their pictures sat in Drive invisible to
// the whole app. The pictures are recoverable because every upload files into
// "<itemNum>/<inventoryId>/" — the inventory id names the copy, so the right
// photos for the right row can be identified deterministically, not guessed.
//
// Rules, deliberately conservative:
//   · only rows with a BLANK photo link are touched — an existing link is
//     never second-guessed;
//   · the per-copy subfolder named for this row's inventory id is the only
//     evidence used when the user owns more than one copy of a number;
//   · the item folder's own loose photos are used only when the user owns
//     EXACTLY ONE copy of that number — otherwise which copy they belong to
//     is genuinely unknowable and the row is left alone;
//   · dryRun reports the plan and writes nothing.
async function driveRepairPhotoLinks(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};
  await driveEnsureSetup();

  const pds = Object.entries((window.state || {}).personalData || {})
    .map(function (e) { return { key: e[0], pd: e[1] }; })
    .filter(function (x) { return x.pd && x.pd.owned && x.pd.itemNum && !x.pd.photoItem; });

  // how many copies of each number are owned — decides whether loose photos
  // in the item folder can be attributed to a single row
  const copies = {};
  Object.values((window.state || {}).personalData || {}).forEach(function (p) {
    if (p && p.owned && p.itemNum) copies[p.itemNum] = (copies[p.itemNum] || 0) + 1;
  });

  const plan = [], noPhotos = [], ambiguous = [];
  for (let i = 0; i < pds.length; i++) {
    const pd = pds[i].pd;
    onProgress(i + 1, pds.length, pd.itemNum);
    let link = '';
    try { link = await driveFindItemFolder(pd.itemNum); } catch (e) {}
    if (!link) { noPhotos.push({ item: pd.itemNum, why: 'no folder' }); continue; }
    const fid = (link.match(/folders\/([a-zA-Z0-9_-]+)/) || [])[1];
    if (!fid) { noPhotos.push({ item: pd.itemNum, why: 'bad link' }); continue; }
    // 1. the per-copy subfolder for THIS row
    let hit = '';
    if (pd.inventoryId) {
      try {
        const q = encodeURIComponent("name='" + String(pd.inventoryId).replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and '" + fid + "' in parents and trashed=false");
        const r = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)');
        const sub = r && r.files && r.files[0] && r.files[0].id;
        if (sub) {
          const ph = await driveGetFolderPhotos(driveFolderLink(sub));
          if (ph && ph.length) hit = driveFolderLink(sub);
        }
      } catch (e) {}
    }
    // 2. loose photos in the item folder — only safe with a single owned copy
    if (!hit) {
      try {
        const ph = await driveGetFolderPhotos(link);
        if (ph && ph.length) {
          if ((copies[pd.itemNum] || 1) === 1) hit = link;
          else { ambiguous.push({ item: pd.itemNum, copies: copies[pd.itemNum], photos: ph.length }); continue; }
        }
      } catch (e) {}
    }
    if (hit) plan.push({ key: pds[i].key, item: pd.itemNum, inv: pd.inventoryId, row: pd.row, link: hit });
    else noPhotos.push({ item: pd.itemNum, why: 'folder has no photos' });
  }

  const result = { candidates: pds.length, willLink: plan.length, noPhotos: noPhotos.length,
                   ambiguous: ambiguous, plan: plan.map(function (p) { return p.item + ' (inv ' + p.inv + ')'; }),
                   linked: 0, failed: [], dryRun: dryRun };
  if (dryRun) return result;

  for (const p of plan) {
    try {
      // v0.9.1252 (row-identity audit, finding 9): the plan was built minutes
      // earlier — one Drive folder lookup and one photo listing per photoless
      // item — and p.row was frozen at that moment. If anything was deleted
      // from My Collection in between, every planned row is one too high and
      // each photo link lands on the item BELOW the one it belongs to.
      // p.key is the stable identity and was already being carried; re-read
      // the row from the live record instead of trusting the snapshot.
      const _live = state.personalData[p.key];
      if (!_live) { result.failed.push({ item: p.item, error: 'item is no longer in the collection' }); continue; }
      const _row = _live.row;
      if (!_row || _row === 99999) { result.failed.push({ item: p.item, error: 'no sheet row yet' }); continue; }
      await sheetsUpdate(state.personalSheetId,
        PERSONAL_TAB + '!' + personalColLetter('photoItem') + _row, [[p.link]]);
      if (state.personalData[p.key]) {
        state.personalData[p.key].photoItem = p.link;
        try { if (typeof rrThumbBust === 'function') rrThumbBust(state.personalData[p.key]); } catch (eTB) {}   // v0.9.1201
      }
      result.linked++;
    } catch (e) { result.failed.push({ item: p.item, error: (e && e.message) || String(e) }); }
  }
  try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
  return result;
}
if (typeof window !== 'undefined') window.driveRepairPhotoLinks = driveRepairPhotoLinks;

async function driveGetFolderPhotos(folderLink) {
  const match = (folderLink || '').match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const folderId = match[1];
  if (!accessToken) return null;
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name,thumbnailLink)&orderBy=name`);
    // v0.9.1261: the `if (res.error)` check is gone — driveRequest raises, and
    // the catch below already returns null, which is what this did anyway.
    return (res.files || []).map(function(f) {
      return {
        id: f.id,
        name: f.name,
        thumbnailLink: f.thumbnailLink || '',
        // Use authenticated media download URL — fetch as blob in loadThumb()
        mediaUrl: 'https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media',
        view: 'https://drive.google.com/file/d/' + f.id + '/view',
      };
    });
  } catch(e) { console.error('driveGetFolderPhotos:', e); return null; }
}

// Fetch a Drive file as an authenticated blob URL for use in <img loading="lazy" src>
const _blobCache = {};
const _thumbLinkCache = {};
var _thumbQ = { hi: [], lo: [], active: 0, max: 6 };
function _thumbEnqueue(task, priority) {
  (priority === 'hi' ? _thumbQ.hi : _thumbQ.lo).push(task);
  _thumbPump();
}
function _thumbPump() {
  while (_thumbQ.active < _thumbQ.max) {
    var task = _thumbQ.hi.shift() || _thumbQ.lo.shift();
    if (!task) return;
    _thumbQ.active++;
    Promise.resolve().then(task).catch(function(){}).then(function(){ _thumbQ.active--; _thumbPump(); });
  }
}
if (typeof window !== 'undefined') window._thumbEnqueue = _thumbEnqueue;

// v0.9.929: prefer Drive's built-in thumbnail (a few KB) over the full original
// (often 2+ MB) for on-screen thumbnails. A small queue avoids flooding Drive;
// inbox images pass priority 'hi' so they load ahead of collection ('lo'). Any
// failure falls back to the original-file path below, so nothing regresses.
function loadDriveThumb(fileId, imgEl, containerEl, thumbLink, priority) {
  if (!fileId || !imgEl) return;
  _thumbEnqueue(function() {
    return _loadDriveThumbSmall(fileId, imgEl, containerEl, thumbLink);
  }, priority === 'hi' ? 'hi' : 'lo');
}
// ── v0.9.1601: the on-device thumbnail bank ─────────────────────────────
// Drive's signed thumbnail links cannot be fetch()ed cross-origin, so the
// bank is filled the one way the browser allows: a separate anonymous
// Image drawn to a canvas, compressed, and stored — fire-and-forget, so a
// CORS refusal costs nothing. Offline, the bank is the only source there is.
var _rrThumbTried = {};
function _rrThumbBank(fileId, link) {
  try {
    if (!window._rrThumbCache || _rrThumbTried[fileId]) return;
    _rrThumbTried[fileId] = 1;
    window._rrThumbCache.get(fileId).then(function (have) {
      if (have) return;
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          var w = im.naturalWidth || 400, h = im.naturalHeight || 400;
          var scale = Math.min(1, 400 / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(function (b) { if (b) window._rrThumbCache.put(fileId, b); }, 'image/jpeg', 0.8);
        } catch (e) {}
      };
      im.onerror = function () {};
      im.src = link;
    }).catch(function () {});
  } catch (e) {}
}

async function _loadDriveThumbSmall(fileId, imgEl, containerEl, thumbLink) {
  try {
    // v0.9.1601: offline — the bank or nothing. A miss shows an honest
    // placeholder instead of a broken image or a hung fetch.
    if ((window._offlineMode || (typeof navigator !== 'undefined' && navigator.onLine === false)) && window._rrThumbCache) {
      var _banked = await window._rrThumbCache.get(fileId);
      if (_banked) { imgEl.src = URL.createObjectURL(_banked); return; }
      if (containerEl) containerEl.innerHTML = '<span style="font-size:0.9rem" title="Not saved on this device yet">\ud83d\udcf5</span>';
      return;
    }
    // Prefer a locally-cached blob (e.g. a just-cropped image) over Drive's
    // server thumbnail, which lags behind edits and would show the old shot.
    if (_blobCache[fileId]) { imgEl.src = _blobCache[fileId]; return; }
    // v0.9.961 (Brad): files we've cropped are marked "force fresh" — Drive's
    // server preview lags (often never regenerates after a bytes-only replace),
    // so it would show the old un-cropped shot on a later visit. For these, skip
    // the stale preview and load the file's real current bytes (which reflect
    // the crop) via the full loader, which also caches the blob for the session.
    if (typeof window !== 'undefined' && window._rrForceFreshBytes && window._rrForceFreshBytes[fileId]) {
      return _loadDriveThumbFull(fileId, imgEl, containerEl);
    }
    var link = thumbLink;
    if (!link) {
      if (Object.prototype.hasOwnProperty.call(_thumbLinkCache, fileId)) {
        link = _thumbLinkCache[fileId];
      } else {
        try {
          var _ac = new AbortController();
          var _to = setTimeout(function() { try { _ac.abort(); } catch (e) {} }, 7000);
          var mr = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink', { headers: { Authorization: 'Bearer ' + accessToken }, signal: _ac.signal });
          clearTimeout(_to);
          link = mr.ok ? ((await mr.json()).thumbnailLink || '') : '';
        } catch (e) { link = ''; }
        _thumbLinkCache[fileId] = link;
      }
    }
    if (link) {
      // v0.9.930: set the thumbnail and RETURN immediately — do NOT await the
      // image's load event. Awaiting it held the queue slot until the picture
      // finished downloading, and a few slow/stalled images deadlocked the
      // whole queue (all slots busy, nothing draining -> every thumbnail blank).
      // The queue now only throttles the metadata fetch; images paint on their
      // own, and any load error falls back to the full original.
      imgEl.onerror = function() { imgEl.onerror = null; _loadDriveThumbFull(fileId, imgEl, containerEl); };
      var _sized = link.replace(/=s\d+(-c)?$/, '=s400');
      imgEl.src = _sized;
      _rrThumbBank(fileId, _sized);   // v0.9.1601: fire-and-forget into the bank
      return;
    }
  } catch (e) {}
  return _loadDriveThumbFull(fileId, imgEl, containerEl);
}
async function _loadDriveThumbFull(fileId, imgEl, containerEl) {
  const cacheKey = fileId;
  if (_blobCache[cacheKey]) { imgEl.src = _blobCache[cacheKey]; return; }
  // v0.9.1602: offline, the banked thumbnail beats an authenticated fetch
  // that cannot happen — the review card's big view shows the banked copy
  // instead of an error square.
  if ((window._offlineMode || (typeof navigator !== 'undefined' && navigator.onLine === false)) && window._rrThumbCache) {
    try {
      var _bk = await window._rrThumbCache.get(fileId);
      if (_bk) { imgEl.src = URL.createObjectURL(_bk); return; }
    } catch (e) {}
    if (containerEl) containerEl.innerHTML = '<span style="font-size:0.9rem" title="Not saved on this device yet">\ud83d\udcf5</span>';
    return;
  }
  try {
    // Use thumbnail endpoint with size parameter (requires auth)
    const thumbUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&acknowledgeAbuse=true`;
    const res = await fetch(thumbUrl, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!res.ok) {
      containerEl.innerHTML = '<span style="font-size:0.65rem;color:var(--text-dim)">⚠ ' + res.status + '</span>';
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    _blobCache[cacheKey] = url;
    imgEl.src = url;
  } catch(e) {
    containerEl.innerHTML = '<span style="font-size:0.65rem;color:var(--text-dim)">⚠ err</span>';
  }
}

function driveFolderLink(folderId) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// v0.9.1011 (Brad): single source of truth for photo file names (no ext).
// "Mfr ItemNum ID## [SET] VIEW" — view last. fileLabel (when given) replaces
// the item number in the name (unit tags like "205-P", or "2025 SET" whose
// SET tag is repositioned after the ID).
function _photoFileName(itemNum, viewAbbr, inventoryId, fileLabel) {
  var base = String(fileLabel || itemNum || '').trim();
  var setTag = /\sSET$/i.test(base);
  if (setTag) base = base.replace(/\sSET$/i, '');
  var mfr = '';
  try { mfr = (typeof _brandOfItem === 'function') ? String(_brandOfItem(itemNum) || '') : ''; } catch (e) {}
  // Manual entries already carry the maker in the label ("Marx Tank Car") —
  // don't double it.
  if (mfr && base.toLowerCase().indexOf(mfr.toLowerCase()) === 0) mfr = '';
  return [mfr, base, (inventoryId ? 'ID' + inventoryId : ''), (setTag ? 'SET' : ''), String(viewAbbr || '')]
    .filter(Boolean).join(' ');
}
if (typeof window !== 'undefined') window._photoFileName = _photoFileName;

// v0.9.1238: onUploaded receives {id, name, folderId} for the file just
// written. The return value stays the FOLDER link, because three callers store
// it as one — the id is handed sideways so nothing downstream has to change.
// Anything that later edits this exact photo needs its id; a name is not an
// identity (see the note in photo-crop.js).
async function driveUploadItemPhoto(file, itemNum, viewAbbr, inventoryId, fileLabel, onUploaded) {
  console.log('[Drive] Uploading photo:', itemNum, viewAbbr, 'invId:', inventoryId || 'none', 'file:', file.name, 'size:', file.size);
  await driveEnsureSetup();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  // v0.9.730 (Brad): pair photos share a folder — the FILENAME carries the
  // unit tag (205-P FV vs 205-D FV) so the gallery labels say which is which.
  //
  // v0.9.1011 (Brad): photos name themselves so they stay identifiable even
  // outside their folder (downloads, Drive search, eBay listings):
  //   "Mfr ItemNum ID## [SET] VIEW.ext"  e.g. "Lionel 2025 ID116 SET RSV.jpg"
  // The VIEW tag stays LAST — galleries label thumbnails from the last word
  // and pick the hero by spotting RSV, so nothing downstream changes.
  // _photoFileName is the ONE place this format lives (the cleanup tool in
  // tools.js reuses it via window._photoFileName).
  const fileName = _photoFileName(itemNum, viewAbbr, inventoryId, fileLabel) + '.' + ext;
  const itemFolderId = await driveEnsureItemFolder(itemNum);
  // If inventoryId provided, create a subfolder for this specific copy
  let folderId = itemFolderId;
  if (inventoryId) {
    const invKey = itemNum + '/' + inventoryId;
    if (driveCache.itemFolders[invKey]) {
      folderId = driveCache.itemFolders[invKey];
    } else {
      folderId = await driveFindOrCreateFolder(String(inventoryId), itemFolderId);
      driveCache.itemFolders[invKey] = folderId;
    }
  }
  console.log('[Drive] Folder ready:', folderId, inventoryId ? '(inv subfolder)' : '(root)', 'Uploading...');
  const result = await driveUploadFile(file, fileName, folderId);
  console.log('[Drive] Upload result:', result && result.id ? 'OK id=' + result.id : 'FAILED', result);
  if (!result || !result.id) {
    throw new Error('Upload returned no file ID');
  }
  if (typeof onUploaded === 'function') {
    try { onUploaded({ id: result.id, name: fileName, folderId: folderId }); }
    catch (eCb) { console.warn('[Drive] onUploaded', eCb); }
  }
  // Return folder link (not individual photo link)
  return driveFolderLink(folderId);
}

// v0.9.1238 (identity audit): this moved the folder named after the ITEM
// NUMBER. Photos for a particular copy live in a subfolder named after its
// inventory id (see driveUploadItemPhoto), so selling one of two 2343s moved
// BOTH copies' photos into Sold — and the copy still in the collection lost
// its pictures.
//
// With an inventory id we move that copy's subfolder and nothing else, into a
// matching item-number folder under Sold Photos so the sold side stays
// organised the same way. Without one, we move the item folder only when there
// is nothing to be wrong about: no copy subfolders beneath it.
const _FOLDER_MIME = 'application/vnd.google-apps.folder';

// v0.9.1268 (audit 2026-08-02 round 2, finding R7): three separate faults in
// this one function, and the fix for all three is a single rule — WE NEVER MOVE
// THE ITEM FOLDER ITSELF. The Sold side gets one folder per item number,
// found-or-created, and the CONTENTS move into it.
//
// What that rule buys, fault by fault:
//
//   1. This searched for the item folder at the top level of My Collection
//      Photos only. Since v0.9.1125 item folders live one level down, under
//      their era ("Lionel Postwar / 2328"). After the era migration this found
//      nothing, returned false, and the caller discarded the false — so the
//      sale saved, the photos never moved, and the Sold record's folder was
//      empty with nothing anywhere admitting it. It now uses
//      _driveItemFolderAnywhere, the same finder driveFindItemFolder and
//      driveEnsureItemFolder already use, so there is one answer to "where does
//      this item's folder live" rather than two that disagree.
//
//   2. Selling the last copy created a Sold folder named after the item AND
//      then moved the original folder — also named after the item — in beside
//      it. Two folders called "2328" under Sold, one of them empty. That is
//      live today, before any migration. Never moving the item folder makes it
//      unrepresentable rather than merely fixed.
//
//   3. The move named driveCache.photosId as the parent being left. Drive's
//      removeParents has to name the folder's REAL parent, which stops being
//      photosId the moment the folder sits under an era. Contents always have a
//      known parent — the item folder we just found — so with rule in place
//      there is no longer a parent this function has to guess at.
//
// The emptied item folder is trashed, not left as a shell and not permanently
// deleted: recoverable for 30 days, the same as every other removal in this app.
//
// The Sold side stays FLAT — one folder per item number, no era level. Mirroring
// the era layout over there may be worth doing, but reorganising the user's
// Drive is not a thing a bug fix gets to do as a side effect.
async function _driveChildFolders(parentId) {
  const q = encodeURIComponent(
    `mimeType='${_FOLDER_MIME}' and '${parentId}' in parents and trashed=false`);
  const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)`);
  return (res && res.files) || [];
}

// The loose photo FILES in a folder. This one pages and _driveChildFolders does
// not, deliberately: a truncated file listing means photos silently left behind
// under the active tree, which is the exact harm R7 is about, whereas an item
// with 200+ copy subfolders is not a collection anyone has.
async function _driveChildFiles(parentId) {
  const out = [];
  let pageToken = '', guard = 0;
  do {
    const q = encodeURIComponent(
      `mimeType!='${_FOLDER_MIME}' and '${parentId}' in parents and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=200` +
                                          (pageToken ? '&pageToken=' + pageToken : ''));
    (res && res.files || []).forEach(function (f) { out.push(f); });
    pageToken = (res && res.nextPageToken) || '';
  } while (pageToken && ++guard < 10);
  return out;
}

// Trash an item folder once its contents have gone to Sold.
//
// It LOOKS before it trashes, because "I moved everything" and "everything is
// gone" are two different claims and only the second one justifies this.
//
// The catch is exonerated, not lazy: reaching it means the photos have already
// arrived in Sold, which is the whole job. Failing the move because we could not
// tidy up an empty folder afterwards would report a real success as a failure
// and send the user looking for photos that are exactly where they should be.
async function _driveRetireEmptyItemFolder(folderId, key) {
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id)&pageSize=2`);
    if (res && res.files && res.files.length) return false;   // not empty — leave it alone
    await driveRequest('PATCH', '/files/' + folderId + '?fields=id', { trashed: true });
    return true;
  } catch (e) {
    console.warn('[Drive] photos moved, but the empty folder for ' + key +
                 ' could not be tidied away:', (e && e.message) || e);
    return false;
  }
}

async function driveMoveToSold(itemNum, inventoryId) {
  await driveEnsureSetup();
  const key = String(itemNum);
  const itemFolderId = await _driveItemFolderAnywhere(key);
  // No folder anywhere means this item never had photos. Nothing was left
  // behind, so that is a success and not a refusal. The caller warns the user
  // on false, and warning on every sale of a photoless item would teach them to
  // ignore the one warning that matters. _driveItemFolderAnywhere raises on a
  // Drive failure rather than returning null, so null really is "none".
  if (!itemFolderId) return true;
  const copies = await _driveChildFolders(itemFolderId);

  // Created only once, and only when there is genuinely something to put in it —
  // an empty "2328" under Sold for an item whose photos we refused to move would
  // be its own small lie.
  let _soldItemFolder = null;
  async function soldFolder() {
    if (!_soldItemFolder) _soldItemFolder = await driveFindOrCreateFolder(key, driveCache.soldPhotosId);
    return _soldItemFolder;
  }

  if (inventoryId) {
    const mine = copies.find(function (f) { return String(f.name) === String(inventoryId); });
    if (mine) {
      await driveMoveFileToFolder(mine.id, itemFolderId, await soldFolder());
      delete driveCache.itemFolders[key + '/' + inventoryId];
      // Only the LAST copy leaves an empty shell; while siblings remain the
      // folder is still someone's home and the emptiness check says so.
      await _driveRetireEmptyItemFolder(itemFolderId, key);
      delete driveCache.itemFolders[key];
      return true;
    }
    // No subfolder for this copy: its photos, if any, sit loose in the item
    // folder. Only safe to move them if no other copy shares that folder.
    if (copies.length) {
      console.warn('[Drive] ' + key + ' has copy folders but none for ' + inventoryId +
                   ' - leaving photos where they are rather than moving another copy\'s');
      return false;
    }
  } else if (copies.length) {
    console.warn('[Drive] ' + key + ' holds ' + copies.length +
                 ' copies and no inventory id was given - not moving anyone\'s photos');
    return false;
  }

  // Loose photos, and no other copy they could belong to.
  const loose = await _driveChildFiles(itemFolderId);
  if (loose.length) {
    const dest = await soldFolder();
    for (let i = 0; i < loose.length; i++) {
      await driveMoveFileToFolder(loose[i].id, itemFolderId, dest);
    }
  }
  await _driveRetireEmptyItemFolder(itemFolderId, key);
  delete driveCache.itemFolders[key];
  return true;
}

// ── DRIVE CONFIG FILE ───────────────────────────────────────────
// Stores personalSheetId in a small JSON file in Drive root
// so any device can find the right sheet after signing in

const CONFIG_FILENAME = 'rail-roster-config.json';
const _OLD_CONFIG_FILENAME = 'boxcar-files-config.json';

async function driveReadConfig(retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  try {
    // Search for new config file first
    let fileId = null;
    // v0.9.981 (isolation fix): only read a config file the user OWNS, so a
    // config shared in from another account can't point them at someone else's sheet.
    const qNew = encodeURIComponent(`name='${CONFIG_FILENAME}' and trashed=false and 'me' in owners`);
    const resNew = await driveRequest('GET', `/files?q=${qNew}&fields=files(id,name)&spaces=drive`);
    if (resNew.files && resNew.files.length > 0) {
      fileId = resNew.files[0].id;
    }
    // Fall back to old config file
    if (!fileId) {
      const qOld = encodeURIComponent(`name='${_OLD_CONFIG_FILENAME}' and trashed=false and 'me' in owners`);
      const resOld = await driveRequest('GET', `/files?q=${qOld}&fields=files(id,name)&spaces=drive`);
      if (resOld.files && resOld.files.length > 0) {
        fileId = resOld.files[0].id;
        // Rename old config to new name
        console.log('[Drive] Renaming config:', _OLD_CONFIG_FILENAME, '→', CONFIG_FILENAME);
        try {
          await driveRequest('PATCH', `/files/${fileId}?fields=id`, { name: CONFIG_FILENAME });
        } catch(e) { console.warn('[Drive] Config rename failed (non-fatal):', e); }
      }
    }
    if (!fileId) return null;
    // Read file contents
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    // v0.9.1266 (audit 2026-08-02 round 2, finding R2). This was the one call
    // in the function that did not go through driveRequest, and so the one
    // call that never looked at whether Drive said yes. Drive answers a
    // refusal with a perfectly well-formed JSON body — {error:{code,message}}
    // — which is truthy, parses fine, and has no personalSheetId in it. The
    // caller in app-auth.js reads that as "this user has never set up a
    // collection", goes looking for a sheet by name, and on a device where
    // that search also fails creates a brand new empty one and writes it into
    // the config as the user's collection.
    //
    // Raising instead hands the case to the retry logic below, which already
    // knows the difference between a 429 worth waiting out and a 403 that will
    // say the same thing three more times, and already falls through to
    // driveFindPersonalSheet on both. The status is attached because that is
    // what the _transient test reads.
    if (!r.ok) {
      const err = new Error('Drive config read failed: HTTP ' + r.status);
      err.status = r.status;
      throw err;
    }
    const parsed = await r.json();
    // A config that is not an object is not a config. An empty file, a stray
    // array, or an HTML interstitial from a captive portal would all otherwise
    // reach the caller as something it tries to read keys off.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[Drive] Config file did not contain an object; ignoring.');
      return null;
    }
    return parsed;
  } catch(e) {
    console.warn(`driveReadConfig error (attempt ${retryCount + 1}):`, e);
    // v0.9.1261 (audit 2026-08-02, finding 2). Retrying is for problems that
    // might go away on their own — a dropped connection, a rate limit, a
    // Google hiccup. "You do not have permission" and "there is no such file"
    // will answer exactly the same way three more times. Before driveRequest
    // raised on 4xx those cases never reached this catch at all; now they do,
    // and retrying them would cost a signing-in user six seconds of staring at
    // a spinner and two alarming toasts on a path that recovers perfectly well
    // by itself (app-auth.js falls through to driveFindPersonalSheet).
    // So: retry the transient, fall straight through on the definite.
    const _transient = !e || !e.status || e.status === 429 || e.status >= 500;
    if (_transient && retryCount < MAX_RETRIES) {
      // Show reconnecting message on first retry
      if (retryCount === 0) showToast('Reconnecting to your collection\u2026');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return driveReadConfig(retryCount + 1);
    }
    // A definite refusal is not worth alarming anyone about: returning null
    // sends app-auth.js down its driveFindPersonalSheet fallback, which finds
    // the sheet by name and works. Only say "could not connect" when we really
    // did try to connect, repeatedly, and could not.
    if (_transient) showToast('Could not connect to your collection. Try signing out and back in.');
    return null;
  }
}

// Fallback: search Drive for the personal sheet by name
// Used when config file read fails — always works as long as the sheet exists in Drive
async function driveFindPersonalSheet() {
  try {
    // v0.9.981 (isolation fix): restrict to spreadsheets the signed-in user
    // OWNS — so a copy of the master catalog, or another collector's sheet,
    // that was merely SHARED into this user's Drive can never be adopted as
    // their personal sheet. Also explicitly drop the master catalog id even if
    // owned (protects the admin account, which does own the master).
    // Search by new prefix first
    const qNew = encodeURIComponent(`name contains 'The Rail Roster -' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and 'me' in owners`);
    const resNew = await driveRequest('GET', `/files?q=${qNew}&fields=files(id,name)&spaces=drive`);
    const ownNew = (resNew.files || []).filter(f => f.id !== MASTER_SHEET_ID);
    if (ownNew.length > 0) {
      return ownNew[0].id;
    }
    // Fall back to old prefix
    const qOld = encodeURIComponent(`name contains 'The Boxcar Files -' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and 'me' in owners`);
    const resOld = await driveRequest('GET', `/files?q=${qOld}&fields=files(id,name)&spaces=drive`);
    const ownOld = (resOld.files || []).filter(f => f.id !== MASTER_SHEET_ID);
    if (ownOld.length > 0) {
      return ownOld[0].id;
    }
    return null;
  } catch(e) {
    console.warn('driveFindPersonalSheet error:', e);
    return null;
  }
}

// v0.9.1266 (audit 2026-08-02 round 2, finding R2). This used to be a whole-file
// replace, and callers pass whatever subset of the four ids they happen to know.
// app-auth.js wrote {personalSheetId} on its own; app-data.js wrote the folder
// ids as '' when driveCache had not been populated yet. Either one erased the
// other three ids from the file EVERY other device reads to find its way around
// — and since the write was also swallowed whole, nothing ever said so.
//
// Three changes, and the reasoning matters more than the code:
//
//   1. It merges. A key whose incoming value is blank means "I do not know
//      this right now", never "erase this". Nothing in the app has any reason
//      to clear an id, so refusing to write a blank costs nothing and closes
//      the whole class of bug rather than the four callers that hit it today.
//   2. If it cannot READ the current file, it does not write. A partial write
//      is the destructive act; declining to write is always recoverable.
//   3. Both uploads are checked and failures are re-thrown, not swallowed.
//
// Returns true when something was written, false when there was nothing worth
// writing. Throws when a write was wanted and could not be completed.
async function driveWriteConfig(data) {
  try {
    // Drop anything blank, null or undefined. What is left is a patch: only
    // the things the caller actually knows.
    const patch = {};
    Object.keys(data || {}).forEach(function (k) { if (data[k]) patch[k] = data[k]; });
    if (Object.keys(patch).length === 0) {
      console.warn('driveWriteConfig: caller knew none of the ids; not writing.');
      return false;
    }

    // Check if file already exists
    // v0.9.981 (isolation fix): only update a config the user OWNS; otherwise
    // fall through to create their own (never overwrite a shared-in config).
    const q = encodeURIComponent(`name='${CONFIG_FILENAME}' and trashed=false and 'me' in owners`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id)&spaces=drive`);
    const fileId = (res.files && res.files.length > 0) ? res.files[0].id : null;

    let merged = patch;
    if (fileId) {
      const cur = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      });
      if (!cur.ok) {
        // The file is there and we could not read it. Writing now would
        // replace ids we cannot see with only the ones we happen to hold.
        const err = new Error('Drive config read-before-write failed: HTTP ' + cur.status);
        err.status = cur.status;
        throw err;
      }
      let current = null;
      try { current = await cur.json(); } catch (e) { current = null; }
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        merged = Object.assign({}, current, patch);
      }
      // An unparseable or non-object config has nothing worth preserving, so
      // the patch stands on its own — that is a repair, not an erasure.
    }

    const blob = new Blob([JSON.stringify(merged)], { type: 'application/json' });

    if (fileId) {
      // Update existing file
      const w = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: blob,
      });
      if (!w.ok) {
        const err = new Error('Drive config write failed: HTTP ' + w.status);
        err.status = w.status;
        throw err;
      }
    } else {
      // Create new file
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: CONFIG_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
      form.append('file', blob);
      const w = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body: form,
      });
      if (!w.ok) {
        const err = new Error('Drive config create failed: HTTP ' + w.status);
        err.status = w.status;
        throw err;
      }
    }
    return true;
  } catch (e) {
    // Logged here so the cause has a name in the console, then re-thrown so
    // callers can react. Every existing caller already has a .catch or a
    // try/catch; the old silent swallow is what let this go unnoticed.
    console.warn('driveWriteConfig error:', e);
    throw e;
  }
}

// Move sheet into vault folder after creation
async function driveMoveSheetToVault(sheetId) {
  await driveEnsureSetup();
  // Get current parents of the sheet file
  const meta = await driveRequest('GET', `/files/${sheetId}?fields=parents`);
  const currentParents = (meta.parents || []).join(',');
  await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${driveCache.vaultId}&removeParents=${currentParents}&fields=id`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}


// ── Lens Staging — temporary public Drive upload for "Identify by Photo" ──
// Photos uploaded here are made readable by anyone with the link so
// Google Lens can fetch them via uploadbyurl. The cleanup helper trashes
// the file shortly after to limit exposure.

async function driveStageLensPhoto(file) {
  // Ensure vault is initialized.
  if (!driveCache.vaultId) {
    var _stored = localStorage.getItem('lv_vault_id');
    if (_stored) driveCache.vaultId = _stored;
  }
  if (!driveCache.vaultId) {
    throw new Error('Drive vault not initialized — please sign in first');
  }
  // Find or create the "_Lens Staging" subfolder (underscore prefix keeps it sorted to top in the vault).
  if (!driveCache.lensStagingId) {
    driveCache.lensStagingId = await driveFindOrCreateFolder('_Lens Staging', driveCache.vaultId);
  }
  // Upload the file.
  var name = 'lens_' + Date.now() + '_' + (file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  var uploaded = await driveUploadFile(file, name, driveCache.lensStagingId);
  if (!uploaded || !uploaded.id) throw new Error('Lens staging upload failed');
  // Set permission: anyone with the link can read. Required so Lens can fetch.
  try {
    await driveRequest('POST', '/files/' + uploaded.id + '/permissions?fields=id', {
      role: 'reader',
      type: 'anyone',
    });
  } catch(e) {
    console.error('[Lens] Could not make staged photo public:', e);
    throw new Error('Could not make photo public for Lens — check Drive permissions');
  }
  // v0.9.1324: stamp the same two appProperties the share machinery uses, so
  // this world-readable file is VISIBLE to rrSweepExpiredShares (and to the
  // Shared Photos page, where the user can revoke it by hand).
  //
  // Why this was a real hole: the only cleanup was a 10-minute setTimeout
  // below. Close the tab, refresh, or let the phone sleep and that timer dies
  // with the page — leaving the photo readable by anyone with the link,
  // forever, with nothing anywhere that could find it again. The v0.9.1303
  // sweeper queries appProperties rrShared='1'; an unstamped file is invisible
  // to it. Stamping costs one PATCH and hands the file to a sweeper that
  // already runs at every app start.
  //
  // Deliberately best-effort: if the stamp fails we still return the URL, because
  // the setTimeout cleanup is unchanged and Lens is the user's actual goal. The
  // stamp is a SECOND net under the timer, not a replacement for it.
  try {
    await driveRequest('PATCH', '/files/' + uploaded.id, {
      appProperties: { rrShared: '1', rrShareExp: String(Date.now() + 10 * 60 * 1000) },
    });
  } catch (eS) { console.warn('[Lens] share stamp failed (timer cleanup still armed):', eS); }
  // Build the public image URL Lens will fetch. v0.9.960 (Brad): the old
  // uc?export=download link is unreliable for outside services — Drive often
  // serves a preview/warning page instead of the raw image, so Lens can get a
  // web page rather than the photo. The /thumbnail endpoint reliably returns
  // real image bytes for any-with-link files; sz=w1600 keeps label text legible.
  var publicUrl = 'https://drive.google.com/thumbnail?id=' + uploaded.id + '&sz=w1600';
  return { id: uploaded.id, url: publicUrl };
}

async function driveCleanupLensStaging(fileId) {
  if (!fileId) return;
  try {
    // Move to trash rather than hard-delete — safer fallback if user wants the file back.
    await driveRequest('PATCH', '/files/' + fileId + '?fields=id', { trashed: true });
  } catch(e) {
    console.warn('[Lens] Cleanup failed (non-fatal):', e);
  }
}

// ── Google Photos picker — SHARED (v0.9.1014, Brad) ─────────────────────
// ONE implementation of the Photos-Picker session dance (open tab → ensure
// scope → create session → poll until the user presses Done → list picks),
// used by BOTH the Photo Inbox import and Identify-from-Photo. Callers
// download picked items with rrGPhotosFile and finish with rrGPhotosEnd.
// Returns { items, auth, sessionId } on success, { error, status? } otherwise
// (error: 'scope' | 'session' | 'network' | 'poll' | 'list' | 'cancelled' | 'timeout').
async function rrGPhotosPickSession(opts) {
  opts = opts || {};
  var onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : function () {};
  var shouldAbort = typeof opts.shouldAbort === 'function' ? opts.shouldAbort : function () { return false; };
  // Open the tab NOW (inside the user's click) so popup blockers stay quiet;
  // it gets pointed at the picker once the session exists.
  var tab = null;
  try { tab = window.open('', '_blank'); } catch (e) {}
  if (typeof _ensurePhotosScope === 'function') {
    var _ok = await _ensurePhotosScope();
    if (!_ok) { try { if (tab) tab.close(); } catch (e) {} return { error: 'scope' }; }
  }
  var auth = { Authorization: 'Bearer ' + window.accessToken };
  var sRes;
  try {
    sRes = await fetch('https://photospicker.googleapis.com/v1/sessions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: '{}' });
  } catch (e) { try { if (tab) tab.close(); } catch (e2) {} return { error: 'network' }; }
  if (!sRes.ok) { try { if (tab) tab.close(); } catch (e) {} return { error: 'session', status: sRes.status }; }
  var s = await sRes.json();
  if (tab) { try { tab.location = s.pickerUri; } catch (e) { tab = null; } }
  // v0.9.1417 (beta tester 1, iPhone): this used to be a bare
  // `window.open(s.pickerUri, '_blank')`. That line runs AFTER the session
  // fetch above, so the user's tap is long spent and Safari blocks it —
  // silently. The app then polled for ten minutes for a picker the collector
  // was never shown, and every button in the Photo Inbox answered "still
  // working on the last batch…" the whole time. A popup cannot be reopened
  // without a fresh gesture, so hand the URL back and let the caller paint
  // something tappable; the poll below keeps running, so the moment they do
  // tap it and press Done, the pick still lands.
  if (!tab) {
    var _opened = null;
    try { _opened = window.open(s.pickerUri, '_blank'); } catch (e) {}
    if (!_opened && typeof opts.onNeedTab === 'function') opts.onNeedTab(s.pickerUri);
  }
  var _ivOf = function (cfg) { try { var dsec = parseFloat(String((cfg || {}).pollInterval || '').replace('s', '')); return dsec > 0 ? Math.max(2000, dsec * 1000) : 0; } catch (e) { return 0; } };
  var iv = _ivOf(s.pollingConfig) || 4000;
  var picked = false, waited = 0;
  // v0.9.1417: onStatus used to be called ONCE, here, and the Photo Inbox's
  // handler paints the waiting line and its Cancel button. Any re-render after
  // that — a refresh, a tab switch back, a rebuild of the toolbar — wiped both,
  // and nothing ever wrote them again. The collector was then locked out of the
  // inbox for the rest of the ten minutes with no reason on screen and no
  // Cancel to press. Repainting on every tick costs nothing (it is the same
  // string) and means the way out can never go missing for more than one poll.
  onStatus('waiting');
  while (!picked && !shouldAbort() && waited < 600000) {
    await new Promise(function (r) { setTimeout(r, iv); });
    onStatus('waiting');
    waited += iv;
    var g;
    try { g = await fetch('https://photospicker.googleapis.com/v1/sessions/' + s.id, { headers: auth }); }
    catch (e) { return { error: 'poll' }; }
    if (!g.ok) return { error: 'poll', status: g.status };
    var gs = await g.json();
    if (gs.mediaItemsSet) picked = true;
    iv = _ivOf(gs.pollingConfig) || iv;
  }
  if (!picked) return { error: shouldAbort() ? 'cancelled' : 'timeout' };
  var items = [], pageToken = '';
  do {
    var lRes = await fetch('https://photospicker.googleapis.com/v1/mediaItems?sessionId=' + encodeURIComponent(s.id) + '&pageSize=100' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''), { headers: auth });
    if (!lRes.ok) return { error: 'list', status: lRes.status };
    var lj = await lRes.json();
    (lj.mediaItems || []).forEach(function (m) { items.push(m); });
    pageToken = lj.nextPageToken || '';
  } while (pageToken);
  return { items: items, auth: auth, sessionId: s.id };
}
// Download one picked media item as a File.
async function rrGPhotosFile(item, auth, fallbackName) {
  var mf = (item && item.mediaFile) || {};
  var bRes = await fetch(mf.baseUrl + '=d', { headers: auth });
  if (!bRes.ok) throw new Error('download ' + bRes.status);
  var blob = await bRes.blob();
  var fname = String(mf.filename || fallbackName || 'photo.jpg').replace(/[^\w.\- ]+/g, '').slice(-60) || (fallbackName || 'photo.jpg');
  return new File([blob], fname, { type: mf.mimeType || 'image/jpeg' });
}
// Best-effort session cleanup.
function rrGPhotosEnd(sessionId, auth) {
  try { fetch('https://photospicker.googleapis.com/v1/sessions/' + sessionId, { method: 'DELETE', headers: auth }); } catch (e) {}
}
if (typeof window !== 'undefined') {
  window.rrGPhotosPickSession = rrGPhotosPickSession;
  window.rrGPhotosFile = rrGPhotosFile;
  window.rrGPhotosEnd = rrGPhotosEnd;
}

// ══ v0.9.1177 — ONE thumbnail cell for every list ═════════════════════════
// Brad: "need thumbnails for the list to the left of description column."
//
// Four list views had already grown their own copy of the same twenty lines —
// a 44px box with a grey picture-frame glyph, look up the item's Drive folder,
// take the first photo, swap it in. The Collection table, the Insurance report,
// the phone cards on Collection and the phone cards on For Sale each did it
// slightly differently, which is why the Collection one had a bug (v0.9.1123)
// that the others never got.
//
// So the fifth copy is not written. This is the one, and the other four can
// move onto it in a later pass without changing how anything looks.
//
// A row with NO photo keeps the placeholder rather than collapsing to blank —
// otherwise the column jitters and it reads as "still loading" forever.
var _RR_THUMB_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
  + 'stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="18" '
  + 'height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';

// The <td> to drop into a row. hostId must be unique on the page.
function rrThumbCellHTML(hostId, size) {
  var s = size || 44;
  return '<td style="width:' + (s + 8) + 'px;text-align:center;padding:2px 4px">'
    + '<div id="' + hostId + '" title="Photo" style="width:' + s + 'px;height:' + s + 'px;'
    + 'border-radius:5px;background:var(--surface2);display:inline-flex;align-items:center;'
    + 'justify-content:center;overflow:hidden;vertical-align:middle">'
    + _RR_THUMB_SVG + '</div></td>';
}

// Fill it, later and quietly. folderLink is the item's photo folder (pd.photoItem
// or an ephemera row's photoLink); numFallback lets a row whose sheet cell is
// still blank find its folder by number, which is the v0.9.1123 fix generalised.
// Never creates a folder — find only.
function rrThumbFill(hostId, folderLink, numFallback, size) {
  try {
    if (typeof driveGetFolderPhotos !== 'function') return;
    var s = size || 40;
    var linkP = folderLink
      ? Promise.resolve(folderLink)
      : ((numFallback && typeof driveFindItemFolder === 'function')
          ? driveFindItemFolder(numFallback).catch(function () { return ''; })
          : Promise.resolve(''));
    linkP.then(function (link) {
      if (!link) return null;
      return driveGetFolderPhotos(link).then(function (photos) {
        var el = document.getElementById(hostId);
        if (!el || !photos || !photos.length) return;   // no photo: keep the placeholder
        var img = document.createElement('img');
        img.style.cssText = 'width:' + s + 'px;height:' + s + 'px;object-fit:cover;border-radius:4px';
        el.innerHTML = '';
        el.appendChild(img);
        loadDriveThumb(photos[0].id, img, el, photos[0].thumbnailLink || null, 'lo');
      });
    }).catch(function () {});
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.rrThumbCellHTML = rrThumbCellHTML;
  window.rrThumbFill = rrThumbFill;
}
