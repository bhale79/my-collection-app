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
  // For 4xx errors (except 401 handled above), return JSON so callers can inspect .error
  // For 5xx server errors, throw
  if (res.status >= 500) {
    var errBody = await res.text().catch(function() { return 'unknown'; });
    console.error('[Drive] Server error:', res.status, endpoint, errBody);
    throw new Error('Drive server error (' + res.status + ')');
  }
  if (!res.ok) {
    console.warn('[Drive] API', res.status, method, endpoint);
  }
  return res.json();
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

async function driveFindOrCreateFolder(name, parentId) {
  if (!parentId) throw new Error('Missing parentId for folder: ' + name);
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&spaces=drive`);
  if (res.error) { console.error('[Drive] Folder search error:', name, res.error); throw new Error('Drive folder search failed: ' + (res.error.message || res.error)); }
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
    // Cache is stale — clear everything
    console.warn('[Drive] Cached photosId stale/invalid, re-running setup');
    driveCache.vaultId = null;
    driveCache.photosId = null;
    driveCache.soldPhotosId = null;
    driveCache.itemFolders = {};
    localStorage.removeItem('lv_vault_id');
    localStorage.removeItem('lv_photos_id');
    localStorage.removeItem('lv_sold_photos_id');
    await driveSetupVault();
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
    // Cached IDs are stale — clear and re-create
    console.warn('[Drive] localStorage folder IDs stale, re-running setup');
    localStorage.removeItem('lv_vault_id');
    localStorage.removeItem('lv_photos_id');
    localStorage.removeItem('lv_sold_photos_id');
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
let _driveEraFolderCache = null;
async function _driveEraFolders(force) {
  if (_driveEraFolderCache && !force) return _driveEraFolderCache;
  const out = {};
  try {
    if (!driveCache.photosId) return (_driveEraFolderCache = out);
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + driveCache.photosId + "' in parents and trashed=false");
    const res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name)&pageSize=200');
    const labels = {};
    try {
      Object.keys(ERAS).forEach(function (k) {
        if (ERAS[k] && ERAS[k].label && k !== 'all') labels[ERAS[k].label] = k;
      });
    } catch (e) {}
    (res.files || []).forEach(function (f) { if (labels[f.name]) out[f.name] = f.id; });
  } catch (e) { console.warn('[Drive] era folder scan:', e && e.message); }
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
async function _driveItemFolderAnywhere(itemNum) {
  const name = String(itemNum || '').trim();
  if (!name || !driveCache.photosId) return null;
  const eras = await _driveEraFolders();
  const parents = [driveCache.photosId].concat(Object.keys(eras).map(function (k) { return eras[k]; }));
  const parentQ = parents.map(function (p) { return "'" + p + "' in parents"; }).join(' or ');
  const q = encodeURIComponent("name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and (" + parentQ + ")");
  const res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name,parents)&spaces=drive');
  const hit = res && res.files && res.files[0];
  return hit ? hit.id : null;
}

async function driveEnsureItemFolder(itemNum, eraHint) {
  await driveEnsureSetup();
  const key = String(itemNum);
  if (driveCache.itemFolders[key]) return driveCache.itemFolders[key];
  // 1. Already exists somewhere? Use it — never create a second home.
  let folderId = null;
  try { folderId = await _driveItemFolderAnywhere(key); } catch (e) {}
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
  const kids = [];
  let pageToken = '';
  do {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + driveCache.photosId + "' in parents and trashed=false");
    const res = await driveRequest('GET', '/files?q=' + q + '&fields=nextPageToken,files(id,name)&pageSize=200' + (pageToken ? '&pageToken=' + pageToken : ''));
    (res.files || []).forEach(function (f) { kids.push(f); });
    pageToken = (res && res.nextPageToken) || '';
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
                   moved: 0, failed: [], dryRun: dryRun, byEra: {} };
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
  for (let i = 0; i < names.length; i++) {
    const eraName = names[i], eraId = eras[eraName];
    let pageToken = '';
    do {
      const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and '" + eraId + "' in parents and trashed=false");
      const res = await driveRequest('GET', '/files?q=' + q + '&fields=nextPageToken,files(id,name)&pageSize=200' + (pageToken ? '&pageToken=' + pageToken : ''));
      (res.files || []).forEach(function (f) {
        const should = driveEraFolderNameFor(f.name, '');
        if (should && should !== eraName) wrong.push({ id: f.id, name: f.name, from: eraName, to: should });
      });
      pageToken = (res && res.nextPageToken) || '';
    } while (pageToken);
  }
  const result = { checked: names.length, wrong: wrong.length, moved: 0, failed: [], dryRun: dryRun, list: wrong };
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

async function driveGetFolderPhotos(folderLink) {
  const match = (folderLink || '').match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const folderId = match[1];
  if (!accessToken) return null;
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name,thumbnailLink)&orderBy=name`);
    if (res.error) { console.warn('Drive photo fetch error:', res.error); return null; }
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
async function _loadDriveThumbSmall(fileId, imgEl, containerEl, thumbLink) {
  try {
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
      imgEl.src = link.replace(/=s\d+(-c)?$/, '=s400');
      return;
    }
  } catch (e) {}
  return _loadDriveThumbFull(fileId, imgEl, containerEl);
}
async function _loadDriveThumbFull(fileId, imgEl, containerEl) {
  const cacheKey = fileId;
  if (_blobCache[cacheKey]) { imgEl.src = _blobCache[cacheKey]; return; }
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

async function driveUploadItemPhoto(file, itemNum, viewAbbr, inventoryId, fileLabel) {
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
  // Return folder link (not individual photo link)
  return driveFolderLink(folderId);
}

async function driveMoveToSold(itemNum) {
  await driveEnsureSetup();
  const key = String(itemNum);
  // Find item folder in My Collection Photos
  const q = encodeURIComponent(`name='${key}' and mimeType='application/vnd.google-apps.folder' and '${driveCache.photosId}' in parents and trashed=false`);
  const res = await driveRequest('GET', `/files?q=${q}&fields=files(id)`);
  if (res.files && res.files.length > 0) {
    const fId = res.files[0].id;
    await driveMoveFileToFolder(fId, driveCache.photosId, driveCache.soldPhotosId);
    delete driveCache.itemFolders[key];
  }
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
    return await r.json();
  } catch(e) {
    console.warn(`driveReadConfig error (attempt ${retryCount + 1}):`, e);
    if (retryCount < MAX_RETRIES) {
      // Show reconnecting message on first retry
      if (retryCount === 0) showToast('Reconnecting to your collection\u2026');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return driveReadConfig(retryCount + 1);
    }
    // All retries failed — show clear message to user
    showToast('Could not connect to your collection. Try signing out and back in.');
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

async function driveWriteConfig(data) {
  try {
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    // Check if file already exists
    // v0.9.981 (isolation fix): only update a config the user OWNS; otherwise
    // fall through to create their own (never overwrite a shared-in config).
    const q = encodeURIComponent(`name='${CONFIG_FILENAME}' and trashed=false and 'me' in owners`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id)&spaces=drive`);
    if (res.files && res.files.length > 0) {
      // Update existing file
      const fileId = res.files[0].id;
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: blob,
      });
    } else {
      // Create new file
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: CONFIG_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
      form.append('file', blob);
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body: form,
      });
    }
  } catch(e) { console.warn('driveWriteConfig error:', e); }
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
  if (!tab) window.open(s.pickerUri, '_blank');
  var _ivOf = function (cfg) { try { var dsec = parseFloat(String((cfg || {}).pollInterval || '').replace('s', '')); return dsec > 0 ? Math.max(2000, dsec * 1000) : 0; } catch (e) { return 0; } };
  var iv = _ivOf(s.pollingConfig) || 4000;
  var picked = false, waited = 0;
  onStatus('waiting');
  while (!picked && !shouldAbort() && waited < 600000) {
    await new Promise(function (r) { setTimeout(r, iv); });
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
