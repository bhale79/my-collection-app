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
  // v0.9.1979 (Brad, "issue 6"): ONE way to get a renewed pass — rrWaitForPass
  // (app-auth.js), waiting RR_RENEW_WAIT_MS (config.js). This used to swap
  // tokenClient.callback and give the renewal 10 s, less than the relay can take.
  // A lapsed pass is now renewed BEFORE the request.
  var _canWait = (typeof rrWaitForPass === 'function') && (typeof rrPassLapsed === 'function') && (typeof rrPassRefused === 'function');
  if (_canWait && state && state.user && rrPassLapsed()) {
    if (!(await rrWaitForPass('drive'))) throw new Error('Session expired — please sign in again');
  }
  var res = await fetch('https://www.googleapis.com/drive/v3' + endpoint, {
    method: method,
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // If 401 (Google refused the pass), renew through the one door and retry once
  if (res.status === 401 && state.user) {
    console.warn('[Drive] 401 — renewing the pass');
    if (!_canWait) throw new Error('Session expired — please sign in again');
    rrPassRefused();
    if (!(await rrWaitForPass('drive 401'))) {
      console.error('[Drive] no renewed pass in time');
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

// ══ v0.9.1872 — A PHOTO CROPPED AT CAPTURE KEEPS ITS ORIGINAL ═══════════════
// photo-crop.js's _cropFirst hands back a cropped File that carries the
// ORIGINAL it was cut from (_rrOriginal) and the box (_rrCropBox). Both
// creators below upload the ORIGINAL as the file — that is the first version,
// the one the writer protects — and then put the crop on top through the ONE
// writer (_cropApplyCaptured → _cropReplaceDriveFile). Every caller still gets
// the file it asked for, holding the crop. A File with no original attached
// uploads exactly as before; nothing but photos ever carries one.
async function _rrUploadKeepingOriginal(file, create) {
  var made = await create(file._rrOriginal);
  if (made && made.id && typeof window !== 'undefined' && typeof window._cropApplyCaptured === 'function') {
    try { await window._cropApplyCaptured(made.id, file); }
    catch (e) { console.warn('[Drive] crop on top of the original failed — the photo is in Drive uncropped', e); }
  }
  return made;
}

// v0.9.1835: an optional fourth argument merges extra metadata into the upload
// (Lens staging sends its cleanup stamp this way — one request, not two).
async function driveUploadFile(file, name, folderId, extraMeta) {
  if (file && file._rrOriginal) return _rrUploadKeepingOriginal(file, function (orig) { return driveUploadFile(orig, name, folderId, extraMeta); });   // v0.9.1872
  if (!folderId) throw new Error('Missing folderId for upload: ' + name);
  if (!accessToken) {
    var _s = localStorage.getItem('lv_token');
    var _e = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (_s && _e > Date.now()) { accessToken = _s; }
    else throw new Error('Not signed in — please sign in and try again');
  }
  const metadata = Object.assign({ name, parents: [folderId], mimeType: file.type }, extraMeta || {});
  // v0.9.2077 (TRR Pro release 6): a Photo Inbox photo carries the collection
  // it was added in — THE one place every inbox upload passes. A photo staged
  // offline brings the collection it was taken in (photo-inbox-offline.js).
  try {
    if (/^INBOX /.test(String(name || '')) && typeof rrInboxUploadTag === 'function') {
      const _ap = Object.assign({}, metadata.appProperties || {});
      if (!_ap.rrColl) { const _t = rrInboxUploadTag(); if (_t) _ap.rrColl = _t; }
      if (_ap.rrColl) metadata.appProperties = _ap;
    }
  } catch (eTag) {}
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
  if (file && file._rrOriginal) return _rrUploadKeepingOriginal(file, function (orig) { return driveUploadPhoto(orig, fileName, folderId); });   // v0.9.1872
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
      personalSheetId: (typeof rrHomeSheet === 'function' ? rrHomeSheet() : state.personalSheetId),   // v0.9.2071: always the HOME sheet
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
const _RR_HOME_SEP = ' \u203a ';   // "Paper › Drawings" — the path of a main folder, as a key and as words

// ── v0.9.2058 (TRR Pro release 4, collections rule 5): photos go to the OPEN
// collection's own photo folder. Home answers exactly what it always did —
// driveCache.photosId / soldPhotosId — so nothing changes for a regular
// customer. Every item-photo path below asks _rrPhotoRoot(), never the cache
// directly (guard test). The folder caches are kept PER collection
// (rrDriveUseRoot, called by collections.js on a switch), so an item number
// that exists in two collections can never be filed into the other's folder.
function _rrPhotoRoot() {
  if (typeof rrIsHome === 'function' && !rrIsHome() && typeof rrPhotoRootId === 'function') return rrPhotoRootId();
  return driveCache.photosId;
}
function _rrSoldPhotoRoot() {
  if (typeof rrIsHome === 'function' && !rrIsHome() && typeof rrSoldPhotoRootId === 'function') return rrSoldPhotoRootId();
  return driveCache.soldPhotosId;
}
let _rrFolderCacheKey = 'home';
const _rrFolderCaches = {};
function rrDriveUseRoot(collKey) {
  const k = String(collKey || 'home');
  _rrFolderCaches[_rrFolderCacheKey] = { items: driveCache.itemFolders, eras: _driveEraFolderCache };
  const got = _rrFolderCaches[k] || { items: {}, eras: null };
  driveCache.itemFolders = got.items;
  _driveEraFolderCache = got.eras;
  _rrFolderCacheKey = k;
}
if (typeof window !== 'undefined') window.rrDriveUseRoot = rrDriveUseRoot;

async function _driveEraFolders(force) {
  if (_driveEraFolderCache && !force) return _driveEraFolderCache;
  const out = {};
  const _root = _rrPhotoRoot();
  if (!_root) return (_driveEraFolderCache = out);   // no photos folder yet: genuinely empty
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + _root + "' in parents and trashed=false");
  const res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name)&pageSize=200');
  const labels = {};
  try {
    Object.keys(ERAS).forEach(function (k) {
      if (ERAS[k] && ERAS[k].label && k !== 'all') labels[ERAS[k].label] = k;
    });
  } catch (e) {}   // ERAS missing is a load-order problem, not a Drive failure — an unlabelled scan is still a real answer
  // v0.9.1995: Paper and Other Items are main folders too, and each folder
  // inside Paper (Drawings, Catalogs…) is a home. Keys are the folder PATH
  // joined with _RR_HOME_SEP — an era label can hold a "/" (Lionel MPC/Modern).
  labels[RR_PHOTO_HOME.PAPER] = 'paper';
  labels[RR_PHOTO_HOME.OTHER] = 'other';
  (res.files || []).forEach(function (f) { if (labels[f.name]) out[f.name] = f.id; });
  if (out[RR_PHOTO_HOME.PAPER]) {
    const q2 = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + out[RR_PHOTO_HOME.PAPER] + "' in parents and trashed=false");
    const res2 = await driveRequest('GET', '/files?q=' + q2 + '&fields=files(id,name)&pageSize=200');
    (res2.files || []).forEach(function (f) { out[RR_PHOTO_HOME.PAPER + _RR_HOME_SEP + f.name] = f.id; });
  }
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
    // v0.9.1996: a number nobody owns that the catalog lists under more than
    // one era is a guess, not an answer (Brad's empty "1998" folder came out
    // as S-Helper; Marx uses the same number five times). Leave it unknown.
    const eraSeen = {};
    (((window.state || {}).masterData) || []).forEach(function (r) {
      if (r && r._era && String(r.itemNum) === n) eraSeen[r._era] = 1;
    });
    if (Object.keys(eraSeen).length > 1) return '';
    if (typeof findMaster === 'function') {
      const m = findMaster(n);
      if (m && m._era) { const l = lab(m._era); if (l) return l; }
    }
  } catch (e) {}
  return '';
}

// ══ v0.9.1995 — EVERY ITEM FOLDER GOES INSIDE A MAIN FOLDER ════════════════
// Brad: "all items need to be in a main folder". Until now an item whose era
// could not be worked out was created at the top of "My Collection Photos" —
// 36 of his folders sat there: 18 drawings, boxes ("6-36814-BOX"), set
// numbers, keepsakes. `_rrPhotoHome` is THE answer to "which main folder?"
// and it never answers "the top level": era folder → (box / sheet ending
// stripped) → what the owned row says it is (paper by its type, catalog,
// memorabilia) → a set number → the number's own shape (DWG-…) → Other Items.
// `why` says which step answered; only 'fallback' is a guess. The names and
// mappings live in RR_PHOTO_HOME (config.js).
function _rrPhotoPaperPath(sub) {
  return [RR_PHOTO_HOME.PAPER, sub || RR_PHOTO_HOME.OTHER_PAPER];
}
function _rrPhotoSectionPath(sectionId, paperType) {
  if (!sectionId || !Object.prototype.hasOwnProperty.call(RR_PHOTO_HOME.SECTION, sectionId)) return null;
  const sub = RR_PHOTO_HOME.SECTION[sectionId];
  if (sub === null) return [RR_PHOTO_HOME.OTHER];
  if (sub === '*') {
    const t = String(paperType || '').split(' — ')[0].trim();
    return _rrPhotoPaperPath(RR_PHOTO_HOME.PAPER_TYPE[t] || '');
  }
  return _rrPhotoPaperPath(sub);
}
// v0.9.1996 — the home a COLLECTION ROW's photos belong in: its era when it
// has one, else its section (paper by type, catalog, memorabilia), else its
// own maker's folder (a manual entry: 10-2210 saved as MTH → MTH Tinplate,
// found by number AND maker in the catalog). null when none of those answer.
function _rrPhotoMakerEra(maker, num) {
  const mk = String(maker || '').trim().toLowerCase();
  if (!mk) return '';
  const eras = Object.keys(ERAS).filter(function (k) {
    return k !== 'all' && ERAS[k] && ERAS[k].label && String(ERAS[k].manufacturer || '').trim().toLowerCase() === mk;
  });
  if (!eras.length) return '';
  const n = String(num || '').trim(), hit = {};
  (((window.state || {}).masterData) || []).forEach(function (r) {
    if (r && String(r.itemNum) === n && eras.indexOf(r._era) !== -1) hit[r._era] = 1;
  });
  const h = Object.keys(hit);
  if (h.length === 1) return ERAS[h[0]].label;
  if (!h.length && eras.length === 1) return ERAS[eras[0]].label;   // the maker has one folder
  return '';
}
function _rrPhotoHomeOfRow(pd) {
  if (!pd) return null;
  const era = String(pd.era || '');
  if (era && era !== 'all' && era !== 'Manual' && ERAS[era] && ERAS[era].label) return { path: [ERAS[era].label], why: 'era' };
  const sec = _rrPhotoSectionPath(ephSectionOfType(pd.itemType), pd.subType);
  if (sec) return { path: sec, why: 'owned' };
  // A box / master box / sheet row files with the item it belongs to
  // (Brad's 6-36814-BOX row carries no era of its own).
  const num = String(pd.itemNum || '').trim();
  const core = num.replace(RR_PHOTO_HOME.PART_SUFFIX, '');
  if (core && core !== num) {
    const ce = driveEraFolderNameFor(core, '');
    if (ce) return { path: [ce], why: 'era' };
  }
  const mk = _rrPhotoMakerEra(pd.manufacturer, core || num);
  if (mk) return { path: [mk], why: 'maker' };
  return null;
}
function _rrPhotoHome(itemNum, eraHint) {
  const H = RR_PHOTO_HOME;
  const n = String(itemNum || '').trim();
  const core = n.replace(H.PART_SUFFIX, '');
  // 1. A catalog era — the item's own, then the item a box / sheet belongs to.
  let era = driveEraFolderNameFor(n, eraHint);
  if (!era && core && core !== n) era = driveEraFolderNameFor(core, '');
  if (era) return { path: [era], why: 'era' };
  // 2. What the collector owns says what it is.
  try {
    const pds = Object.values((window.state || {}).personalData || {});
    const own = pds.find(function (p) { return p && p.owned && String(p.itemNum) === n; })
             || pds.find(function (p) { return p && p.owned && String(p.itemNum) === core; });
    if (own) {
      const h = _rrPhotoHomeOfRow(own);
      if (h) return h;
    }
  } catch (e) {}
  // 3. A set number — the Sets tab is one era's.
  try {
    const sets = (window.state || {}).setData || [];
    if (core && sets.some(function (st) { return st && String(st.setNum || '').trim() === core; })) {
      const lab = ERAS[H.SET_ERA] && ERAS[H.SET_ERA].label;
      if (lab) return { path: [lab], why: 'set' };
    }
  } catch (e) {}
  // 4. The number's own shape: DWG-1957-386 is a drawing, 8157-PAP paper.
  const code = (core.match(/^([A-Z]{2,3})-/) || [])[1];
  if (code && Object.prototype.hasOwnProperty.call(H.PAPER_CODE, code)) {
    return { path: _rrPhotoPaperPath(H.PAPER_CODE[code]), why: 'number' };
  }
  for (let i = 0; i < H.SECTION_NUMBER.length; i++) {
    if (H.SECTION_NUMBER[i].re.test(core)) {
      return { path: _rrPhotoSectionPath(H.SECTION_NUMBER[i].section, ''), why: 'number' };
    }
  }
  // 5. Never the top level.
  return { path: [H.OTHER], why: 'fallback' };
}
function rrPhotoHomeFor(itemNum, eraHint) { return _rrPhotoHome(itemNum, eraHint).path.slice(); }

// The main folder (and the folder inside it) an item's folder goes into,
// found or made, by PATH. Refuses an empty path: there is no "top level".
async function _driveEnsureHomePath(path) {
  if (!Array.isArray(path) || !path.length) throw new Error('A photo folder must go inside a main folder');
  const homes = await _driveEraFolders();
  let parent = _rrPhotoRoot(), key = '';
  // v0.9.2058: no photo folder for this collection = refuse; never a folder at the top of My Drive.
  if (!parent) throw new Error('Photos folder not ready');
  for (let i = 0; i < path.length; i++) {
    key = key ? key + _RR_HOME_SEP + path[i] : path[i];
    if (!homes[key]) {
      homes[key] = await driveFindOrCreateFolder(path[i], parent);   // asks Drive live first, so no copy
      _driveEraFolderCache = homes;
    }
    parent = homes[key];
  }
  return parent;
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
  const _root = _rrPhotoRoot();
  if (!name || !_root) return null;

  const parentsOf = function (eras) {
    return [_root].concat(Object.keys(eras).map(function (k) { return eras[k]; }));
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
  // v0.9.2058: THIS collection's folder cache, held for the whole call — an
  // answer that arrives after a switch lands in the collection that asked.
  const _cache = driveCache.itemFolders;
  if (_cache[key]) return _cache[key];
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
  // 2. Otherwise create it inside its main folder — never at the top level.
  //    v0.9.1995: the old catch here dropped a folder at the top level when
  //    its era folder could not be made. Now a failure raises like step 1's,
  //    and every caller already reports a retryable failure.
  if (!folderId) {
    const parentId = await _driveEnsureHomePath(rrPhotoHomeFor(key, eraHint));
    folderId = await driveFindOrCreateFolder(key, parentId);
  }
  _cache[key] = folderId;
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
    const _cache = driveCache.itemFolders;   // v0.9.2058: this collection's cache, held for the call
    if (_cache[name]) return driveFolderLink(_cache[name]);
    if (!_rrPhotoRoot()) return '';
    // v0.9.1125: searches the root AND every era folder, so a migrated folder
    // is still found. Still find-only — it never creates anything.
    const id = await _driveItemFolderAnywhere(name);
    if (!id) return '';
    _cache[name] = id;
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

// ── v0.9.1995 — THE TIDY-UP: every loose folder into its main folder ───────
// Was the v0.9.1125 one-time era migration, which LEFT any folder whose era it
// could not tell at the top level and ran once by hand. Now every loose folder
// goes to the main folder `_rrPhotoHome` names (Other Items when nothing else
// places it), and it runs on its own (rrPhotoTidySoon) once switched on.
// Safe because:
//   · a folder KEEPS ITS ID when it moves, so every photoItem link in the
//     sheet still resolves — nothing to rewrite, nothing to break;
//   · the finder looks in the top level AND every main folder, so a
//     half-finished run leaves the app working exactly as well as a finished one;
//   · a folder whose destination already holds one of the same name is LEFT
//     ALONE and reported — moving it would split that item's photos in two;
//   · main folders and the app's own feature folders are never moved;
//   · re-running it is a no-op for anything already moved.
// dryRun:true reports the plan and touches nothing.
async function driveTidyPhotoFolders(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};
  await driveEnsureSetup();
  const _tidyRoot = _rrPhotoRoot();
  if (!_tidyRoot) throw new Error('Photos folder not ready');

  // Every folder sitting at the top level right now.
  // v0.9.1261 (audit 2026-08-02, finding 2): this listing decides what gets
  // moved, so a page that fails to arrive is not a detail — it is a set of
  // folders that will silently never be moved. It records that the listing
  // is incomplete and says so in the result. A partial run is still safe to
  // do — every move is idempotent and ids never change.
  const kids = [];
  let pageToken = '', listComplete = true, guard = 0;
  do {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + _tidyRoot + "' in parents and trashed=false");
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

  // Main folders are destinations, and feature folders stay where they are.
  const mainNames = {};
  try {
    Object.keys(ERAS).forEach(function (k) {
      if (ERAS[k] && ERAS[k].label && k !== 'all') mainNames[ERAS[k].label] = 1;
    });
  } catch (e) {}
  mainNames[RR_PHOTO_HOME.PAPER] = 1;
  mainNames[RR_PHOTO_HOME.OTHER] = 1;
  RR_PHOTO_HOME.FEATURE.forEach(function (nm) { mainNames[nm] = 1; });

  // v0.9.1996 (Brad: "yes" to deciding by what is inside): a folder's
  // inventory-number folders say whose photos these are — the inventory id is
  // the identity, the folder's NAME can be stale ("310-141" held the photos of
  // his 84631). All of them one item's home → that home; photos of items no
  // longer in the collection, or of items that live in different places →
  // Other Items, and the list says why. A folder with nothing in it is never
  // moved — it is listed for the collector to decide. Only a folder holding
  // loose photos alone is placed by its name.
  const byInv = {};
  try {
    Object.values((window.state || {}).personalData || {}).forEach(function (p) {
      if (p && p.inventoryId) byInv[String(p.inventoryId)] = p;
    });
  } catch (e) {}
  const plan = [], empty = [], unread = [];
  for (let i = 0; i < kids.length; i++) {
    const f = kids[i];
    if (mainNames[f.name]) continue;                     // a main folder itself
    let inside;
    try {
      const qc = encodeURIComponent("'" + f.id + "' in parents and trashed=false");
      inside = (await driveRequest('GET', '/files?q=' + qc + '&fields=files(id,name,mimeType)&pageSize=200')).files || [];
    } catch (e) { unread.push(f.name); continue; }        // never guess at what could not be read
    if (!inside.length) { empty.push(f.name); continue; }
    const subs = inside.filter(function (x) { return x.mimeType === 'application/vnd.google-apps.folder'; });
    let home;
    if (subs.length) {
      // The folder's NAME, when it is the number of an item the collector
      // owns, says whose photos these are even if the inventory folders
      // inside do not match a current row — measured on Brad's Drive: older
      // saves named the inside folder one below the row's inventory id
      // (lantern 307 → "306", 30-9107 159 → "158"). An inside folder that
      // DOES match a current row living somewhere else still makes it mixed.
      const nameRow = Object.values((window.state || {}).personalData || {}).find(function (p) {
        return p && p.owned && String(p.itemNum) === f.name;
      });
      const nameHome = nameRow ? _rrPhotoHomeOfRow(nameRow) : null;
      const homes = subs.map(function (x) { return byInv[x.name] ? (_rrPhotoHomeOfRow(byInv[x.name]) || { path: [RR_PHOTO_HOME.OTHER], why: 'fallback' }) : null; });
      const known = homes.filter(Boolean);
      if (nameHome) known.push(nameHome);
      const keys = {};
      known.forEach(function (h) { keys[h.path.join(_RR_HOME_SEP)] = h; });
      if (!known.length) home = { path: [RR_PHOTO_HOME.OTHER], why: 'orphaned' };
      else if (Object.keys(keys).length !== 1) home = { path: [RR_PHOTO_HOME.OTHER], why: 'mixed' };
      else if (nameHome) home = { path: nameHome.path, why: 'contents' };
      else if (known.length === subs.length) home = { path: known[0].path, why: 'contents' };
      else home = { path: [RR_PHOTO_HOME.OTHER], why: 'mixed' };
    } else {
      home = _rrPhotoHome(f.name, '');
    }
    plan.push({ id: f.id, name: f.name, path: home.path, to: home.path.join(_RR_HOME_SEP), why: home.why });
  }

  const result = { total: kids.length, planned: plan.length,
                   plan: plan.map(function (p) { return { name: p.name, to: p.to, why: p.why }; }),
                   empty: empty, unread: unread,
                   moved: 0, skipped: [], failed: [], dryRun: dryRun, byHome: {},
                   listComplete: listComplete && !unread.length };
  if (!listComplete) result.warning = 'Drive stopped listing folders partway — this run covers only what was read. Re-run it; moves already made are not repeated.';
  else if (unread.length) result.warning = 'Drive would not show what is inside ' + unread.length + ' folder(s); they were left where they are. Re-run it.';
  plan.forEach(function (p) { result.byHome[p.to] = (result.byHome[p.to] || 0) + 1; });
  if (dryRun) return result;

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    try {
      const destId = await _driveEnsureHomePath(p.path);
      const qn = encodeURIComponent("name='" + p.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and '" + destId + "' in parents and trashed=false");
      const there = await driveRequest('GET', '/files?q=' + qn + '&fields=files(id)&spaces=drive');
      if ((there.files || []).some(function (x) { return x.id !== p.id; })) {
        result.skipped.push({ name: p.name, to: p.to, why: 'a folder with this name is already there — left for you to look at' });
        continue;
      }
      // addParents/removeParents is a MOVE — the folder id is unchanged, so
      // every stored link keeps working.
      await driveRequest('PATCH', '/files/' + p.id + '?addParents=' + destId +
                                  '&removeParents=' + _tidyRoot + '&fields=id');
      driveCache.itemFolders[p.name] = p.id;
      result.moved++;
    } catch (e) {
      result.failed.push({ name: p.name, to: p.to, error: (e && e.message) || String(e) });
    }
    onProgress(i + 1, plan.length, p.name);
  }
  _driveEraFolderCache = null;                            // rescan next time
  return result;
}

// The tidy-up on its own: once per collection per TIDY_EVERY_HOURS, a while
// after start-up so the collection (which names paper and keepsakes) has
// loaded. Only while RR_PHOTO_HOME.AUTO_TIDY is on (on since v0.9.1998). Never throws.
let _rrPhotoTidyTimer = null;
function rrPhotoTidySoon() {
  try {
    if (!RR_PHOTO_HOME.AUTO_TIDY || _rrPhotoTidyTimer) return;
    _rrPhotoTidyTimer = setTimeout(async function () {
      try {
        const sheet = (window.state || {}).personalSheetId || '';
        if (!sheet || typeof accessToken === 'undefined' || !accessToken) return;
        const key = 'lv_photo_tidy_at:' + sheet;
        let last = 0;
        try { last = Number(localStorage.getItem(key)) || 0; } catch (e) {}
        if (Date.now() - last < RR_PHOTO_HOME.TIDY_EVERY_HOURS * 3600000) return;
        const r = await driveTidyPhotoFolders({});
        if (r.listComplete && !r.failed.length) { try { localStorage.setItem(key, String(Date.now())); } catch (e) {} }
        if (r.moved || r.skipped.length || r.failed.length) console.log('[Drive] photo tidy-up:', r.moved, 'moved,', r.skipped.length, 'left,', r.failed.length, 'failed');
      } catch (e) { console.warn('[Drive] photo tidy-up:', e && e.message); }
    }, RR_PHOTO_HOME.TIDY_FIRST_DELAY_MS);
  } catch (e) {}
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
  // The Paper main folder holds only type folders, never items — skip it.
  const names = Object.keys(eras).filter(function (k) { return k !== RR_PHOTO_HOME.PAPER; });
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
        // v0.9.1995: a home is a PATH ("Paper › Drawings"); a fallback answer
        // is a guess and never moves a folder that is already filed.
        const home = _rrPhotoHome(f.name, '');
        const should = home.why === 'fallback' ? '' : home.path.join(_RR_HOME_SEP);
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
      if (!eras[w.to]) eras[w.to] = await _driveEnsureHomePath(w.to.split(_RR_HOME_SEP));
      await driveRequest('PATCH', '/files/' + w.id + '?addParents=' + eras[w.to] +
                                  '&removeParents=' + eras[w.from] + '&fields=id');
      result.moved++;
    } catch (e) { result.failed.push({ name: w.name, error: (e && e.message) || String(e) }); }
  }
  _driveEraFolderCache = null;
  return result;
}

if (typeof window !== 'undefined') {
  window.driveMigrateItemFoldersToEras = driveTidyPhotoFolders;   // the old name, kept for the console
  window.driveTidyPhotoFolders = driveTidyPhotoFolders;
  window.rrPhotoTidySoon = rrPhotoTidySoon;
  window.rrPhotoHomeFor = rrPhotoHomeFor;
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
// v0.9.1834 — A PICTURE THE APP ALREADY KNOWS SHOWS AT ONCE. Returns true
// when it did (the caller can skip its fade-in), false when the picture went
// to the queue. The dashboard is rebuilt on every data event — each catalog
// landing at start, the collection refresh, every save — and every rebuild
// re-created every <img> and sent it back through this queue, so pictures
// the browser already held went blank and faded back in, dozens of times a
// session (release readiness N3: "the photo strip blanks and reloads").
function loadDriveThumb(fileId, imgEl, containerEl, thumbLink, priority) {
  if (!fileId || !imgEl) return false;
  if (_rrThumbKnown(fileId, imgEl, containerEl, thumbLink)) return true;
  _thumbEnqueue(function() {
    return _loadDriveThumbSmall(fileId, imgEl, containerEl, thumbLink);
  }, priority === 'hi' ? 'hi' : 'lo');
  return false;
}
// The part of _loadDriveThumbSmall that needs no waiting, in the same order
// it decides: offline → not here (the bank is asynchronous); a session blob
// (a just-cropped picture) → that; a force-fresh file → not here (it needs
// the full loader); a thumbnail link already known → that, with the same
// fallback to the full file on error and the same fire-and-forget bank.
function _rrThumbKnown(fileId, imgEl, containerEl, thumbLink) {
  try {
    if (window._offlineMode || (typeof navigator !== 'undefined' && navigator.onLine === false)) return false;
    if (_blobCache[fileId]) { imgEl.src = _blobCache[fileId]; return true; }
    if (typeof window !== 'undefined' && window._rrForceFreshBytes && window._rrForceFreshBytes[fileId]) return false;
    var link = thumbLink || (Object.prototype.hasOwnProperty.call(_thumbLinkCache, fileId) ? _thumbLinkCache[fileId] : '');
    if (!link) return false;
    imgEl.onerror = function() { imgEl.onerror = null; _loadDriveThumbFull(fileId, imgEl, containerEl); };
    imgEl.src = link.replace(/=s\d+(-c)?$/, '=s400');
    _rrThumbBank(fileId);
    return true;
  } catch (e) { return false; }
}
if (typeof window !== 'undefined') window._rrThumbKnown = _rrThumbKnown;
// ── v0.9.1601/1603: the on-device thumbnail bank ────────────────────────
// v1601 tried to fill the bank from the signed thumbnail links via an
// anonymous Image + canvas. MEASURED DEAD on 2026-08-28 (Session 87, in
// Brad's own Chrome, on his own inbox photo): lh3.googleusercontent
// refuses BOTH a cors fetch ("Failed to fetch") AND an anonymous image
// load (onerror) — the bank stayed at zero and Brad's airplane test showed
// sixteen placeholders. The one route the browser allows is the same one
// _loadDriveThumbFull already uses: the AUTHENTICATED alt=media fetch
// (googleapis serves CORS), downscaled in-browser to a ~30KB JPEG
// (measured: 2.75MB → 28KB, ~3s). Full bytes per photo is the price, so:
// lo-priority queue slot (never crowds a real load), one attempt per file
// per session, capped per session, and skipped when already banked.
var _rrThumbTried = {};
// ── v0.9.1631 (Brad's hero crop): A CROP SHOWS ITSELF ─────────────────────
// "i cropped the picture, applied it and it shows the precropped picture."
// The crop SAVED — but every renderer kept serving stale bytes. This is the
// ONE answer, called by every successful crop replace: the fresh bytes land
// in the session blob cache (every later render hits it first), the stale
// server-thumbnail memo and retry guard are dropped, the on-device bank is
// overwritten with the cropped bytes (offline shows truth too), and the
// file is marked force-fresh so future sessions skip Drive's lagging
// preview. (The inbox prunes force-fresh markers to its own files — fine:
// by the time a detail-cropped marker lapses, the bank holds the crop and
// Drive has usually regenerated its preview.)
if (typeof window !== 'undefined') window.rrPhotoBytesChanged = function (fileId, blob) {
  try {
    if (!fileId || !blob) return;
    try { _blobCache[fileId] = URL.createObjectURL(blob); } catch (e) {}
    try { delete _thumbLinkCache[fileId]; } catch (e) {}
    try { delete _rrThumbTried[fileId]; } catch (e) {}
    try { if (window._rrThumbCache) window._rrThumbCache.put(fileId, blob); } catch (e) {}
    try { if (typeof window._rrMarkCropped === 'function') window._rrMarkCropped(fileId); } catch (e) {}
  } catch (e) {}
};
var _rrThumbBanked = 0;
var _RR_THUMB_BANK_CAP = 80;   // per session — a show day's worth, not a data bill
// v0.9.1911: ONE shrinker — the thumbnail bank (400 px) and the Google Lens
// copy (RR_LENS) both use it. Never upscales; any failure hands back the
// original, so a photo is never lost to a shrink.
async function _rrShrinkImage(bigBlob, maxSide, quality) {
  try {
    var bmp = await createImageBitmap(bigBlob);
    var w = bmp.width || maxSide, h = bmp.height || maxSide;
    var scale = Math.min(1, maxSide / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    try { if (bmp.close) bmp.close(); } catch (eC) {}
    var small = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', quality); });
    return (small && small.size && small.size < bigBlob.size) ? small : bigBlob;
  } catch (e) { return bigBlob; }
}
async function _rrThumbShrink(bigBlob) { return _rrShrinkImage(bigBlob, 400, 0.8); }
function _rrThumbBank(fileId) {
  try {
    if (!window._rrThumbCache || _rrThumbTried[fileId]) return;
    if (_rrThumbBanked >= _RR_THUMB_BANK_CAP) return;
    if (window._offlineMode || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    _rrThumbTried[fileId] = 1;
    window._rrThumbCache.get(fileId).then(function (have) {
      if (have) return;
      _thumbEnqueue(async function () {
        try {
          if (_rrThumbBanked >= _RR_THUMB_BANK_CAP) return;
          var res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: { Authorization: 'Bearer ' + accessToken } });
          if (!res.ok) return;
          var small = await _rrThumbShrink(await res.blob());
          if (small && small.size) { window._rrThumbCache.put(fileId, small); _rrThumbBanked++; }
        } catch (e) {}
      }, 'lo');
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
      _rrThumbBank(fileId);   // v0.9.1603: fire-and-forget into the bank (authenticated path)
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
      // v0.9.1921: a file Drive cannot find for this account is forgotten from
      // the remembered photo list (dashboard.js), so the tile heals next pass.
      if ((res.status === 404 || res.status === 403) && typeof window.rrThumbForgetFid === 'function') window.rrThumbForgetFid(fileId);
      containerEl.innerHTML = '<span style="font-size:0.65rem;color:var(--text-dim)">⚠ ' + res.status + '</span>';
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    _blobCache[cacheKey] = url;
    imgEl.src = url;
    // v0.9.1603: the big bytes are already here — bank the downscale free.
    try {
      if (window._rrThumbCache && !_rrThumbTried[fileId]) {
        _rrThumbTried[fileId] = 1;
        _rrThumbShrink(blob).then(function (sm) { if (sm && sm.size) window._rrThumbCache.put(fileId, sm); }).catch(function () {});
      }
    } catch (eBk) {}
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
  // v0.9.1630 (Brad's 238 audit): a set/together shot has NO view — the old
  // "SET RSV" spelling made it masquerade as a second Right Side everywhere
  // the view resolver looked. SET is the whole identity now.
  return [mfr, base, (inventoryId ? 'ID' + inventoryId : ''), (setTag ? 'SET' : ''), (setTag ? '' : String(viewAbbr || ''))]
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
  const _cache = driveCache.itemFolders;   // v0.9.2058: this collection's cache, held for the call
  const itemFolderId = await driveEnsureItemFolder(itemNum);
  // If inventoryId provided, create a subfolder for this specific copy
  let folderId = itemFolderId;
  if (inventoryId) {
    const invKey = itemNum + '/' + inventoryId;
    if (_cache[invKey]) {
      folderId = _cache[invKey];
    } else {
      folderId = await driveFindOrCreateFolder(String(inventoryId), itemFolderId);
      _cache[invKey] = folderId;
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
    if (!_soldItemFolder) _soldItemFolder = await driveFindOrCreateFolder(key, _rrSoldPhotoRoot());
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

// ══ PREFERENCES THAT FOLLOW THE ACCOUNT (v0.9.1779) ═══════════════════════
// [stated] Brad: his phone said photo reads were off while his desktop said 20
// left. v0.9.1775 moved THAT one setting to the account and said plainly that
// every other preference was still per-device, because `_prefGet`/`_prefSet`
// (app.js) are plain localStorage. This finishes the job for all of them.
//
// WHY NOT appProperties, the v1775 mechanism: Google caps an app at **30
// private properties per file**, 124 bytes each. Eighteen settings each need a
// value AND a timestamp — 36 — before counting the two the Photo ID switch
// already uses. It is out on arithmetic, not taste.
//   https://developers.google.com/workspace/drive/api/guides/properties
//
// WHY ITS OWN FILE and not rail-roster-config.json, which already exists and
// already has a tested merge: that file holds the ids that FIND the user's
// sheet and vault. Brand-new preference code must not be able to damage them.
// Single-source-of-truth is about not storing one value twice — it is not a
// reason to crowd unrelated data into one blast radius.
//
// WHAT SYNCS: exactly the keys written through `_prefSet`. No list to keep in
// step — a preference joins simply by being set the normal way. Keys written
// with a bare `localStorage.setItem` (lv_vault_id and friends) are device
// identity and deliberately stay out.
//
// PER-KEY TIMESTAMPS, not one for the file. With a single stamp, changing the
// theme on the phone would stamp over a dashboard tweak just made on the
// desktop — the same "each device believes itself" bug v0.9.1771 fixed for
// photo reads, one layer up.
const PREFS_FILENAME = 'rail-roster-prefs.json';
const PREF_AT_SUFFIX = '__at';          // local only; never written to Drive
// v0.9.1830: keys that once synced and must now leave every device AND the
// file. The merge can only add or update — a key nobody writes any more would
// otherwise sit in the account for ever and be re-applied to every device that
// signs in. `rr_crop_flash` was the crop-flash recorder's diary (v1826–1829).
const PREFS_RETIRED = ['rr_crop_flash'];

// The merge is a PURE FUNCTION so it can be tested for real rather than
// inferred from the IO around it. `local` is the device's values, `stamps` when
// each was last changed here, `remote` the file's {key:{v,t}} map.
// Returns what to apply locally and what to push, and nothing else.
// v0.9.1937 — `unions` ({key: combine(accountText, deviceText)}, from config.js
// RR_PREF_UNION) and `met` ({key: true} once this device has been reconciled
// with the account for that key — stored locally as key + '__met'). A LIST the
// user built on two devices before it synced (the saved storage locations) is
// COMBINED the first time the two meet, so neither device's list is thrown
// away; from then on the ordinary newest-wins rule below applies, so a removal
// made on one device sticks on the other.
// v0.9.2058 — `always` ({key: combine(accountText, deviceText)}, config.js
// RR_PREF_ALWAYS_UNION): a MAP two devices may each add to at any time (the
// permanent shelf IDs). Newest-wins would let one device's write drop an id
// the other just printed on a label, so these are COMBINED on every meeting,
// not only the first. The combine must be canonical (same text for the same
// map) so two devices that agree stop writing.
function rrPrefsMerge(local, stamps, remote, now, unions, met, always) {
  local = local || {}; stamps = stamps || {}; remote = remote || {};
  unions = unions || {}; met = met || {}; always = always || {};
  const apply = {}, push = {};
  const keys = {};
  Object.keys(local).forEach(function (k) { keys[k] = 1; });
  Object.keys(remote).forEach(function (k) { keys[k] = 1; });

  Object.keys(keys).forEach(function (k) {
    const r = remote[k];
    if (typeof always[k] === 'function') {
      const hasA = Object.prototype.hasOwnProperty.call(local, k);
      if (!r) { if (hasA) push[k] = { v: local[k], t: (Number(stamps[k]) || 0) > 0 ? Number(stamps[k]) : now }; return; }
      if (!hasA) { apply[k] = r.v; apply[k + PREF_AT_SUFFIX] = String(r.t); return; }
      const both = String(always[k](r.v, local[k]));
      if (both !== String(local[k])) { apply[k] = both; apply[k + PREF_AT_SUFFIX] = String(now); }
      if (both !== String(r.v)) push[k] = { v: both, t: now };
      return;
    }
    if (typeof unions[k] === 'function' && !met[k]) {
      const MET = '__met';
      const hasL = Object.prototype.hasOwnProperty.call(local, k);
      apply[k + MET] = '1';
      if (!r) { push[k] = { v: local[k], t: (Number(stamps[k]) || 0) > 0 ? Number(stamps[k]) : now }; return; }
      if (!hasL) { apply[k] = r.v; apply[k + PREF_AT_SUFFIX] = String(r.t); return; }
      const both = String(unions[k](r.v, local[k]));
      if (both === String(r.v)) { apply[k] = r.v; apply[k + PREF_AT_SUFFIX] = String(r.t); return; }
      apply[k] = both; apply[k + PREF_AT_SUFFIX] = String(now);
      push[k] = { v: both, t: now };
      return;
    }
    const rt = (r && typeof r.t === 'number') ? r.t : -1;
    const hasLocal = Object.prototype.hasOwnProperty.call(local, k);
    const lt = hasLocal ? (Number(stamps[k]) || 0) : -1;

    if (!hasLocal) { apply[k] = r.v; apply[k + PREF_AT_SUFFIX] = String(rt); return; }
    // Only this device knows it. SEEDING: a value set before v0.9.1779 has no
    // stamp, so it is dated `now` — it is real, it just has no history.
    if (rt < 0) { push[k] = { v: local[k], t: lt > 0 ? lt : now }; return; }

    // FIRST RUN where the file already has an answer is NOT a special case:
    // an unstamped local value scores 0, so the line below adopts the remote
    // one — the device that seeded the file wins and this one falls in behind.
    // (A separate `lt === 0` branch was written here first. It was dead code
    // that read as load-bearing, and its planted offender proved it by not
    // offending. The rule is real; the branch was not.)
    if (rt > lt) { apply[k] = r.v; apply[k + PREF_AT_SUFFIX] = String(rt); }
    else if (lt > rt) { push[k] = { v: local[k], t: lt }; }
    // equal: both sides already agree. Writing would be pure churn.
  });
  return { apply: apply, push: push };
}

let _prefsFileId = null, _prefsPushTimer = null;
const _prefsDirty = {};

async function _prefsFindFile() {
  if (_prefsFileId) return _prefsFileId;
  const q = encodeURIComponent(`name='${PREFS_FILENAME}' and trashed=false and 'me' in owners`);
  const res = await driveRequest('GET', `/files?q=${q}&fields=files(id)&spaces=drive`);
  _prefsFileId = (res.files && res.files.length > 0) ? res.files[0].id : null;
  return _prefsFileId;
}

// { ok, prefs }. ok:false means the file is THERE and could not be read —
// never write in that case, or values we cannot see are replaced by the ones
// we happen to hold. Same rule driveWriteConfig learned. No file at all, or an
// unparseable one, is not a failure: there is nothing to preserve.
async function _prefsRead() {
  const id = await _prefsFindFile();
  if (!id) return { ok: true, prefs: {} };
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media',
                        { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!r.ok) return { ok: false, prefs: null };
  try {
    const j = await r.json();
    return { ok: true, prefs: (j && typeof j === 'object' && j.prefs && typeof j.prefs === 'object') ? j.prefs : {} };
  } catch (e) { return { ok: true, prefs: {} }; }
}

async function _prefsWrite(prefs) {
  const blob = new Blob([JSON.stringify({ prefs: prefs })], { type: 'application/json' });
  const id = await _prefsFindFile();
  if (id) {
    const w = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media',
      { method: 'PATCH', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: blob });
    if (!w.ok) throw new Error('prefs write failed: HTTP ' + w.status);
  } else {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: PREFS_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', blob);
    const w = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, body: form });
    if (!w.ok) throw new Error('prefs create failed: HTTP ' + w.status);
    try { const j = await w.json(); _prefsFileId = j && j.id ? j.id : null; } catch (e) {}
  }
}

// Every key this device has ever set through _prefSet, and when.
// v0.9.1937: plus every RR_PREF_UNION key this device holds even if it was
// never stamped (the saved locations were written raw before v1937) — scored 0
// — so the merge COMBINES it instead of the account's copy landing on top of
// it unseen. `met` says which of those keys have already been combined once.
function _prefsLocalState() {
  const local = {}, stamps = {}, met = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.slice(-PREF_AT_SUFFIX.length) !== PREF_AT_SUFFIX) continue;
      const base = k.slice(0, -PREF_AT_SUFFIX.length);
      const v = localStorage.getItem(base);
      if (v === null) continue;
      local[base] = v;
      stamps[base] = localStorage.getItem(k);
    }
    const U = (typeof window !== 'undefined' && window.RR_PREF_UNION) || {};
    Object.keys(U).forEach(function (k) {
      if (localStorage.getItem(k + '__met') === '1') met[k] = true;
      if (Object.prototype.hasOwnProperty.call(local, k)) return;
      const v = localStorage.getItem(k);
      if (v !== null) { local[k] = v; stamps[k] = '0'; }
    });
  } catch (e) {}
  return { local: local, stamps: stamps, met: met };
}

// Drop the retired keys from this device and from the account's map. Returns
// true when the FILE held one, so the caller rewrites it even with nothing
// else to push. The sync runs it before
// _prefsLocalState, so the merge never sees them.
function _prefsRetire(remotePrefs) {
  let dropped = false;
  PREFS_RETIRED.forEach(function (k) {
    try { localStorage.removeItem(k); localStorage.removeItem(k + PREF_AT_SUFFIX); } catch (e) {}
    if (remotePrefs && Object.prototype.hasOwnProperty.call(remotePrefs, k)) { delete remotePrefs[k]; dropped = true; }
  });
  return dropped;
}

function _prefsApply(apply) {
  let touched = false;
  Object.keys(apply).forEach(function (k) {
    try {
      if (localStorage.getItem(k) === String(apply[k])) return;
      localStorage.setItem(k, String(apply[k]));
      if (k.slice(-PREF_AT_SUFFIX.length) !== PREF_AT_SUFFIX && k.slice(-5) !== '__met') touched = true;
    } catch (e) {}
  });
  return touched;
}

// One pass: read, merge, apply what the account knows, push what this device
// knows that is newer. Safe to call more than once.
window.rrPrefsSync = async function () {
  try {
    if (!accessToken) return false;
    const got = await _prefsRead();
    if (!got.ok) return false;                       // read failed: never write
    const dropped = _prefsRetire(got.prefs);         // v0.9.1830: retired keys leave both sides first
    const st = _prefsLocalState();
    const m = rrPrefsMerge(st.local, st.stamps, got.prefs, Date.now(), (window.RR_PREF_UNION || {}), st.met, (window.RR_PREF_ALWAYS_UNION || {}));
    // v0.9.1836: the Collector's Market / photo-ID ticket is ONE per account
    // now. When the merge hands this device a different one, vault.js is told
    // so the old ticket's data goes and the reads label follows the new one.
    let tokenBefore = null;
    try { tokenBefore = localStorage.getItem('lv_vault_token'); } catch (e) {}
    const touched = _prefsApply(m.apply);
    try {
      const tokenAfter = localStorage.getItem('lv_vault_token');
      if (tokenBefore && tokenAfter && tokenAfter !== tokenBefore && typeof window.rrVaultTokenChanged === 'function') {
        window.rrVaultTokenChanged(tokenBefore, tokenAfter);
      }
    } catch (e) {}
    if (Object.keys(m.push).length || dropped) {
      const merged = Object.assign({}, got.prefs, m.push);
      await _prefsWrite(merged);
    }
    return touched;
  } catch (e) { console.warn('rrPrefsSync:', e); return false; }
  finally {
    // v0.9.1815: anything that must not decide before the account's settings
    // have had their first say (the Dispatch Board's popup) waits on this.
    // Set on EVERY exit — a failed pull is still a finished pull.
    window._rrPrefsSyncDone = true;
  }
};

// _prefSet calls this. Debounced, because a settings page can fire several
// changes in a row and each one is a whole file write.
window.rrPrefsQueuePush = function (key) {
  _prefsDirty[key] = 1;
  if (_prefsPushTimer) clearTimeout(_prefsPushTimer);
  _prefsPushTimer = setTimeout(function () {
    _prefsPushTimer = null;
    window.rrPrefsSync();
  }, 1500);
};

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


// ── Lens Staging — a temporary public copy for "Identify by Photo" ─────────
// Google Lens fetches the picture by URL (uploadbyurl), so the app gives it a
// copy it can reach: a file in the vault's "_Lens Staging" folder, readable
// by anyone with the link. The cleanup helper trashes it ten minutes later,
// and the v0.9.1303 sweeper catches any the timer missed (the stamp below).
//
// ══ v0.9.1835 — NO ROUND TRIP THROUGH THE PHONE ═══════════════════════════
// [stated] Brad: "when you use google lens to id something in the app, is
// there anyway to speed that up?" — and, after the walk-through: "i want the
// words to help id so tell me what we can do to speed it up without losing
// that." The words (the q= hint on the Lens link) are untouched; what changed
// is the staging in front of the link:
//   1. A photo that is ALREADY in Drive (the Photo Inbox) is copied on
//      Google's side — one small request — instead of being downloaded to
//      the phone and uploaded back (two full-size transfers, 3–4 MB each on
//      a 12 MP shot). driveStageLensCopy.
//   2. The cleanup stamp rides the copy (or the upload) instead of a second
//      PATCH.
//   3. A copy still alive is REUSED: search the same photo again inside the
//      window and the link opens at once. One memo for both paths.
//   The picture Lens fetches stays 1600 px wide (small stampings stay legible).
// A photo that only exists on the phone (the wizard's camera shot) still has
// to be uploaded once — driveStageLensPhoto — with the stamp folded in.
var _RR_LENS_TTL_MS = 10 * 60 * 1000;     // how long a staged copy lives (timer + sweeper stamp)
var _RR_LENS_REUSE_MS = 9 * 60 * 1000;    // reuse only while a full minute of life is left
var _rrLensMemo = {};                     // key → { id, url, exp }
function _rrLensStamp() { return { rrShared: '1', rrShareExp: String(Date.now() + _RR_LENS_TTL_MS) }; }
function _rrLensUrl(id) {
  // v0.9.960 (Brad): the old uc?export=download link is unreliable for outside
  // services — Drive often serves a preview/warning page instead of the raw
  // image. The /thumbnail endpoint reliably returns real image bytes for
  // any-with-link files; sz=w1600 keeps label text legible.
  return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600';
}
function _rrLensAlive(key) {
  var m = _rrLensMemo[key];
  return (m && Date.now() < m.exp) ? { id: m.id, url: m.url, reused: true } : null;
}
function _rrLensRemember(key, id) {
  _rrLensMemo[key] = { id: id, url: _rrLensUrl(id), exp: Date.now() + _RR_LENS_REUSE_MS };
  return { id: id, url: _rrLensUrl(id), reused: false };
}
async function _rrLensFolder() {
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
  return driveCache.lensStagingId;
}
// Anyone with the link may read — required so Lens can fetch. Not optional:
// a copy nobody can reach is a failed search, so this one throws.
async function _rrLensPublish(id) {
  try {
    await driveRequest('POST', '/files/' + id + '/permissions?fields=id', { role: 'reader', type: 'anyone' });
  } catch(e) {
    console.error('[Lens] Could not make staged photo public:', e);
    throw new Error('Could not make photo public for Lens — check Drive permissions');
  }
}

// ══ v0.9.1942 — WAIT FOR DRIVE'S PREVIEW BEFORE LENS FETCHES IT ═══════════
// Lens fetches _rrLensUrl — Drive's PREVIEW of the copy — and Drive makes that
// preview a few seconds after an upload or copy. Brad's first Lens search came
// back "your message was empty or cut off" (Google got the words, no picture);
// the retry, which reused the same copy seconds later, worked. So a NEW copy is
// held until Drive says its preview exists (thumbnailLink), asked every
// RR_LENS.READY_POLL_MS, at most RR_LENS.READY_MAX_MS — then Lens opens either
// way, exactly as it did before. A reused copy is old enough already.
// Returns true when Drive confirmed the preview, false when it gave up waiting.
async function _rrLensWaitReady(id, onStep) {
  var L = (typeof RR_LENS !== 'undefined') ? RR_LENS : {};
  var every = L.READY_POLL_MS || 500, max = L.READY_MAX_MS || 10000;
  var t0 = Date.now(), ready = false, tries = Math.max(1, Math.ceil(max / every));   // counted, not clocked
  for (var n = 1; n <= tries; n++) {
    try {
      var f = await driveRequest('GET', '/files/' + encodeURIComponent(id) + '?fields=hasThumbnail,thumbnailLink');
      if (f && f.thumbnailLink) { ready = true; break; }
    } catch (e) { /* a refused check is not a reason to block the search */ }
    if (n < tries) await new Promise(function (r) { setTimeout(r, every); });
  }
  try { if (typeof onStep === 'function') onStep(ready ? 'lens: preview ready' : 'lens: preview not confirmed (opened anyway)', Date.now() - t0); } catch (eS) {}
  return ready;
}
if (typeof window !== 'undefined') window._rrLensWaitReady = _rrLensWaitReady;

// A photo already in Drive: copied on Google's side, stamped in the same
// request, published. Nothing is downloaded or uploaded by the device.
async function driveStageLensCopy(sourceFileId) {
  if (!sourceFileId) throw new Error('No photo to send to Lens');
  var key = 'drive:' + sourceFileId;
  var alive = _rrLensAlive(key);
  if (alive) return alive;
  var stagingId = await _rrLensFolder();
  var copied = await driveRequest('POST', '/files/' + encodeURIComponent(sourceFileId) + '/copy?fields=id',
    { name: 'lens_' + Date.now() + '_copy.jpg', parents: [stagingId], appProperties: _rrLensStamp() });
  if (!copied || !copied.id) throw new Error('Lens staging copy failed');
  await _rrLensPublish(copied.id);
  await _rrLensWaitReady(copied.id);   // v0.9.1942
  return _rrLensRemember(key, copied.id);
}

// A photo that exists only on this device (the wizard's camera shot):
// uploaded once, stamped in the same request, published.
// v0.9.1913: is this phone on cellular (or asking to save data / on a slow
// link)? Android Chrome says so through navigator.connection; a browser that
// does not (iPhone Safari, desktops) answers "no" and gets the Wi-Fi copy.
function _rrOnCellular() {
  try {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return false;
    return c.type === 'cellular' || c.saveData === true || /(^|-)(2g|3g)$/.test(String(c.effectiveType || ''));
  } catch (e) { return false; }
}
// v0.9.1911: onStep(name, ms) — optional; the Lens flow times each step.
async function driveStageLensPhoto(file, onStep) {
  if (!file) throw new Error('No photo to send to Lens');
  var step = function (n, t0) { try { if (typeof onStep === 'function') onStep(n, Date.now() - t0); } catch (eS) {} };
  var key = 'file:' + (file.name || '') + ':' + (file.size || 0) + ':' + (file.lastModified || 0);
  var alive = _rrLensAlive(key);
  if (alive) return alive;
  // v0.9.1911: Lens gets a SMALL copy (RR_LENS, config.js) — the upload and
  // Google's fetch-back were the 25 s Brad waited. The key above is the
  // original's, so a re-search within ten minutes still reuses the upload.
  var t = Date.now();
  var L = (typeof RR_LENS !== 'undefined') ? RR_LENS : { PHOTO_MAX_SIDE: 1600, PHOTO_QUALITY: 0.85, SHRINK_OVER_BYTES: 350000 };
  // v0.9.1913: on cellular, the smaller copy (RR_LENS.CELL_*)
  var cell = _rrOnCellular() && L.CELL_MAX_SIDE;
  var side = cell ? L.CELL_MAX_SIDE : L.PHOTO_MAX_SIDE, qual = cell ? L.CELL_QUALITY : L.PHOTO_QUALITY;
  var over = cell ? L.CELL_SHRINK_OVER_BYTES : L.SHRINK_OVER_BYTES;
  if ((file.size || 0) > over && /^image\//.test(file.type || 'image/')) {
    var small = await _rrShrinkImage(file, side, qual);
    if (small !== file) file = new File([small], (file.name || 'photo.jpg').replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
  }
  step(cell ? 'lens: shrink photo (cellular)' : 'lens: shrink photo', t);
  t = Date.now();
  var stagingId = await _rrLensFolder();
  step('lens: find folder', t);
  var name = 'lens_' + Date.now() + '_' + (file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  // v0.9.1324: the same two appProperties the share machinery uses, so this
  // world-readable file is VISIBLE to rrSweepExpiredShares (and to the Shared
  // Photos page, where the user can revoke it by hand). Why: the only cleanup
  // used to be a 10-minute setTimeout; close the tab or let the phone sleep
  // and that timer died with the page, leaving the photo readable by anyone
  // with the link, forever. The sweeper runs at every app start.
  t = Date.now();
  var uploaded = await driveUploadFile(file, name, stagingId, { appProperties: _rrLensStamp() });
  if (!uploaded || !uploaded.id) throw new Error('Lens staging upload failed');
  step('lens: upload ' + Math.round((file.size || 0) / 1024) + ' KB', t);
  t = Date.now();
  await _rrLensPublish(uploaded.id);
  step('lens: share link', t);
  await _rrLensWaitReady(uploaded.id, onStep);   // v0.9.1942: Lens fetches the preview — wait until it exists
  return _rrLensRemember(key, uploaded.id);
}
if (typeof window !== 'undefined') { window.driveStageLensCopy = driveStageLensCopy; window.driveStageLensPhoto = driveStageLensPhoto; }

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
// v0.9.2030: the words for a refused picker session (RR_GPHOTOS_WAIT,
// config.js), by Google's reason and status. '' = no special words.
function rrGPhotosErrorWords(pick) {
  var W = (typeof RR_GPHOTOS_WAIT !== 'undefined') ? RR_GPHOTOS_WAIT : {};
  if (!pick || pick.error !== 'session') return '';
  var email = (typeof state !== 'undefined' && state && state.user && state.user.email) || 'your Google account';
  var reason = String(pick.reason || '').toUpperCase();
  if (reason.indexOf('FAILED_PRECONDITION') >= 0 || (pick.status === 400 && !reason)) return String(W.errNotSetUp || '').replace('{email}', email);
  // a bare 401/403 keeps its older words (errSetup — the Picker API itself); only
  // Google saying the PASS lacks the permission gets the sign-out-and-back words
  if (reason.indexOf('SCOPE_INSUFFICIENT') >= 0 || reason.indexOf('PERMISSION_DENIED') >= 0) return String(W.errRefused || '').replace('{email}', email);
  if (pick.status === 429 || reason.indexOf('RESOURCE_EXHAUSTED') >= 0) return W.errBusy || '';
  return '';
}
if (typeof window !== 'undefined') window.rrGPhotosErrorWords = rrGPhotosErrorWords;
async function rrGPhotosPickSession(opts) {
  opts = opts || {};
  var onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : function () {};
  var shouldAbort = typeof opts.shouldAbort === 'function' ? opts.shouldAbort : function () { return false; };
  // Open the tab NOW (inside the user's click) so popup blockers stay quiet;
  // it gets pointed at the picker once the session exists.
  var tab = null;
  // v0.9.2026 (a York customer: "Google Photos permission was not granted" —
  // and no way to grant it). A browser lets ONE click open ONE window. When
  // the pass does not carry Photos permission yet, Google's permission window
  // must be that one: opening our Photos tab first used it up, Chrome blocked
  // Google's window, and the answer came back "not granted" every time — for
  // every account that had not granted it before (the owner's had, so he never
  // saw it). So the tab is opened first ONLY when no permission window is
  // coming; otherwise the picker is offered with an "Open Google Photos"
  // button once the permission is in (onNeedTab, below).
  var _askFirst = (typeof _ensurePhotosScope === 'function') && (typeof _rrPassHasScope === 'function')
    && (typeof SCOPE_PHOTOS !== 'undefined') && !_rrPassHasScope(SCOPE_PHOTOS);
  if (!_askFirst) { try { tab = window.open('', '_blank'); } catch (e) {} }
  // v0.9.2032 (Mike, York): Google's permission window shows "Google hasn't
  // verified this app" until the review is done. Say so first, once per account.
  if (_askFirst) {
    var _go = await rrGPhotosUnverifiedNotice();
    if (!_go) return { error: 'cancelled' };
  }
  if (typeof _ensurePhotosScope === 'function') {
    var _ok = await _ensurePhotosScope();
    if (!_ok) { try { if (tab) tab.close(); } catch (e) {} return { error: 'scope' }; }
    try { if (typeof _prefSet === 'function' && _prefGet(RR_GPHOTOS_GRANTED_KEY, '') !== '1') _prefSet(RR_GPHOTOS_GRANTED_KEY, '1'); } catch (eG) {}
  }
  var auth = { Authorization: 'Bearer ' + window.accessToken };
  var sRes;
  try {
    sRes = await fetch('https://photospicker.googleapis.com/v1/sessions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: '{}' });
  } catch (e) { try { if (tab) tab.close(); } catch (e2) {} return { error: 'network' }; }
  if (!sRes.ok) {
    try { if (tab) tab.close(); } catch (e) {}
    // v0.9.2030: Google's own reason rides along (a York customer saw only
    // "(400)"; Google's body said FAILED_PRECONDITION — the account had never
    // set up Google Photos). rrGPhotosErrorWords turns it into words.
    var _reason = '';
    try { var _eb = await sRes.json(); _reason = String((_eb && _eb.error && (_eb.error.status || _eb.error.message)) || ''); } catch (eJ) {}
    return { error: 'session', status: sRes.status, reason: _reason };
  }
  var s = await sRes.json();
  // v0.9.1936 (Brad: "i then have to manually switch back to the app"):
  // Google's picker closes its own tab when the user presses Done if its
  // address ends in /autoclose — the browser then drops them back on the app.
  if (s.pickerUri && !/\/autoclose$/.test(s.pickerUri)) s.pickerUri = String(s.pickerUri).replace(/\/+$/, '') + '/autoclose';
  if (typeof opts.onUri === 'function') { try { opts.onUri(s.pickerUri); } catch (e) {} }
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
    if (!_opened && typeof opts.onNeedTab === 'function') opts.onNeedTab(s.pickerUri, { askedFirst: _askFirst });
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
  // v0.9.1936 (Brad: "a few seconds it show the picture i selected"): the
  // wait between asks is cut short the moment the app's tab is in front again
  // (the user came back from Google Photos), so the answer is fetched at once.
  var _nap = function (ms) {
    return new Promise(function (resolve) {
      var over = false;
      var wake = function () {
        if (over) return;
        if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') return;
        finish();
      };
      var finish = function () {
        if (over) return;
        over = true;
        try { document.removeEventListener('visibilitychange', wake); } catch (e) {}
        try { window.removeEventListener('focus', wake); } catch (e) {}
        resolve();
      };
      try { document.addEventListener('visibilitychange', wake); } catch (e) {}
      try { window.addEventListener('focus', wake); } catch (e) {}
      setTimeout(finish, ms);
    });
  };
  onStatus('waiting');
  while (!picked && !shouldAbort() && waited < 600000) {
    await _nap(iv);
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

// ── v0.9.1936 — ONE way to bring photos in from Google Photos ─────────────
// [stated] Brad 2026-10-13: "when i switch back to the app it show the google
// photo button again, and a few seconds it show the picture i selected. so
// for a few seconds, the user doesn't know to wait or to click or what to do
// … the app should switch to a 'waiting on photo to upload' screen".
// rrGPhotosPickFiles covers the screen with a waiting panel the moment Google
// Photos opens and keeps it up — waiting, then "bringing your photo in" —
// until the files are in hand, so the screen behind it is never mistaken for
// a fresh start. Every caller but the Photo Inbox (which has its own waiting
// line and Cancel) comes through here; the scan in gphotos_wait_tests fails a
// new one that doesn't. Wording: RR_GPHOTOS_WAIT (config.js).
//   opts: { max (1 = one photo), fallbackName, shouldAbort }
//   -> { files: [File…], picked: n }  or  { error, status? }
//      error: the session's own, plus 'cancelled' | 'none' | 'download'
function _rrGPW() { return (typeof RR_GPHOTOS_WAIT !== 'undefined' && RR_GPHOTOS_WAIT) || {}; }
function _rrGPWaitShow(many) {
  var W = _rrGPW();
  var old = document.getElementById('rr-gp-wait');
  if (old) { try { old.remove(); } catch (e) {} }
  if (!document.getElementById('rr-gp-wait-css')) {
    var st = document.createElement('style');
    st.id = 'rr-gp-wait-css';
    st.textContent = '@keyframes rrGpSpin{to{transform:rotate(360deg)}}'
      + '#rr-gp-wait .rr-gp-spin{width:42px;height:42px;border-radius:50%;border:4px solid var(--border);border-top-color:var(--accent);animation:rrGpSpin 0.9s linear infinite;margin:0 auto 0.9rem}'
      + '#rr-gp-wait button{font-family:var(--font-body);font-size:1rem;font-weight:700;padding:0.65rem 1.2rem;border-radius:9px;cursor:pointer}';
    document.head.appendChild(st);
  }
  var ov = document.createElement('div');
  ov.id = 'rr-gp-wait';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-live', 'polite');
  ov.style.cssText = 'position:fixed;inset:0;z-index:100050;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
  ov.innerHTML =
    '<div style="background:var(--surface);color:var(--text);border:1.5px solid var(--border);border-radius:14px;max-width:440px;width:100%;padding:1.4rem 1.3rem;text-align:center">'
    + '<div class="rr-gp-spin"></div>'
    + '<div data-gpw="title" style="font-family:var(--font-head);font-size:1.25rem;margin-bottom:0.6rem"></div>'
    + '<div data-gpw="how" style="font-size:1rem;line-height:1.45;color:var(--text-mid);margin-bottom:0.5rem"></div>'
    + '<div data-gpw="stage" style="font-size:0.95rem;font-weight:700;color:var(--accent2);min-height:1.4em;margin-bottom:1rem"></div>'
    + '<div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap">'
    + '<button type="button" data-gpw="reopen" style="display:none;border:1.5px solid var(--accent2);background:transparent;color:var(--accent2)"></button>'
    + '<button type="button" data-gpw="cancel" data-close="1" style="border:1.5px solid var(--border);background:var(--surface2);color:var(--text)"></button>'
    + '</div></div>';
  document.body.appendChild(ov);
  var q = function (k) { return ov.querySelector('[data-gpw="' + k + '"]'); };
  q('title').textContent = many ? (W.titleMany || '') : (W.title || '');
  q('how').textContent = (many ? (W.howMany || '') : (W.how || '')) + ' ' + (W.after || '');
  q('cancel').textContent = W.cancel || '';
  q('reopen').textContent = W.reopen || '';
  var panel = {
    el: ov, cancelled: false, uri: '',
    stage: function (k) { var t = q('stage'); if (t) t.textContent = W[k] || ''; if (k === 'fetching') { var r = q('reopen'); if (r) r.style.display = 'none'; } },
    setUri: function (u) { panel.uri = u || ''; var r = q('reopen'); if (r && panel.uri) r.style.display = ''; },
    close: function () { try { ov.remove(); } catch (e) {} },
  };
  q('reopen').onclick = function () { if (panel.uri) { try { window.open(panel.uri, '_blank'); } catch (e) {} panel.needTab = false; panel.stage('waiting'); } };
  var cancel = function () { panel.cancelled = true; panel.close(); };
  q('cancel').onclick = cancel;
  if (typeof window.rrDismissGuard === 'function') window.rrDismissGuard(ov, cancel);   // Back = Cancel; a stray tap on the backdrop does nothing
  panel.stage('opening');
  return panel;
}
// Runs synchronously up to the session call, so Google Photos' tab still opens
// inside the user's click (popup blockers stay quiet).
function rrGPhotosPickFiles(opts) {
  opts = opts || {};
  var max = Math.max(1, opts.max || 1);
  var panel = _rrGPWaitShow(max > 1);
  var aborted = function () { return panel.cancelled || !!(opts.shouldAbort && opts.shouldAbort()); };
  return window.rrGPhotosPickSession({
    shouldAbort: aborted,
    // v0.9.2026: while Google Photos could not be opened for the person, the
    // panel keeps saying so (press Open Google Photos) — each poll used to
    // overwrite it at once with "Waiting for you to press Done".
    onStatus: function () { if (!panel.needTab) panel.stage('waiting'); },
    onUri: function (u) { panel.setUri(u); },
    onNeedTab: function (u, info) { panel.setUri(u); panel.needTab = true; panel.stage(info && info.askedFirst ? 'permitted' : 'blocked'); },
  }).then(async function (pick) {
    try {
      if (aborted()) { if (pick && pick.sessionId) window.rrGPhotosEnd(pick.sessionId, pick.auth); return { error: 'cancelled' }; }
      if (!pick || pick.error) return pick || { error: 'session' };
      var ph = (pick.items || []).filter(function (m) { return String(m.type || '').toUpperCase() !== 'VIDEO'; });
      if (!ph.length) { window.rrGPhotosEnd(pick.sessionId, pick.auth); return { error: 'none' }; }
      panel.stage('fetching');
      var files = [];
      try {
        for (var i = 0; i < ph.length && i < max; i++) {
          var f = await window.rrGPhotosFile(ph[i], pick.auth, max > 1 ? ('gphotos-' + (i + 1) + '.jpg') : (opts.fallbackName || 'photo.jpg'));
          if (f) files.push(f);
          if (aborted()) break;
        }
      } catch (eDl) { window.rrGPhotosEnd(pick.sessionId, pick.auth); return { error: 'download' }; }
      window.rrGPhotosEnd(pick.sessionId, pick.auth);
      if (aborted()) return { error: 'cancelled' };
      if (!files.length) return { error: 'download' };
      return { files: files, picked: ph.length };
    } finally { panel.close(); }
  }, function () { panel.close(); return { error: 'network' }; });
}
// What to tell the user about a result that brought nothing back ('' = say nothing).
// v0.9.2032 — the words before Google's "hasn't verified this app" page. Shown
// only while this ACCOUNT has never granted the Photos permission (the flag
// travels with the account through _prefSet); once granted, Google does not
// show the page again and neither do we. Resolves true = go on to Google.
var RR_GPHOTOS_GRANTED_KEY = 'lv_gphotos_granted';
async function rrGPhotosUnverifiedNotice() {
  var W = _rrGPW();
  try { if (typeof _prefGet === 'function' && _prefGet(RR_GPHOTOS_GRANTED_KEY, '') === '1') return true; } catch (e) {}
  return await appConfirm(W.unverified || '', { title: W.unverifiedTitle || '', ok: W.unverifiedGo || 'OK', cancel: W.unverifiedNo || 'Cancel' });
}
function rrGPhotosErrText(res) {
  var W = _rrGPW(), e = res && res.error;
  if (!e || e === 'cancelled') return '';
  var _words = rrGPhotosErrorWords(res);   // v0.9.2030: Google's own reason first (the Add steps' route — the York customer's "(400)")
  if (_words) return _words;
  if (e === 'session' && (res.status === 401 || res.status === 403)) return W.errSetup || '';
  if (W['err_' + e]) return W['err_' + e];
  return String(W.errOther || '').replace('{status}', res.status ? ' (' + res.status + ')' : '');
}
if (typeof window !== 'undefined') {
  window.rrGPhotosPickSession = rrGPhotosPickSession;
  window.rrGPhotosFile = rrGPhotosFile;
  window.rrGPhotosEnd = rrGPhotosEnd;
  window.rrGPhotosPickFiles = rrGPhotosPickFiles;
  window.rrGPhotosErrText = rrGPhotosErrText;
  window.rrGPhotosUnverifiedNotice = rrGPhotosUnverifiedNotice;   // v0.9.2032
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

// v0.9.2058 (collections rule 4): every Drive request is COUNTED, so a switch
// of collection waits until none is out — a folder lookup that answers after
// a switch must never land in the other collection's folder cache.
if (typeof rrTrackWrites === 'function') {
  driveRequest = rrTrackWrites(driveRequest);
  driveUploadFile = rrTrackWrites(driveUploadFile);
}
