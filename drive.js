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
function getItemLabel(d) {
  // Try master data lookup first
  const itemNum = (d.itemNum || '').trim().replace(/-[PD]$/, '');
  const master = state.masterData.find(m => m.itemNum === itemNum || m.itemNum === d.itemNum);
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
  return res.json();
}

async function driveMoveFileToFolder(fileId, fromFolderId, toFolderId) {
  await driveRequest('PATCH', `/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}&fields=id`, {});
}

// Called once on first run — creates the full vault folder structure
async function driveSetupVault() {
  // Use 'root' directly as parent ID — Drive API accepts it without needing to look up the ID
  driveCache.vaultId = await driveFindOrCreateFolder('The Boxcar Files - My Collection', 'root');
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

async function driveEnsureItemFolder(itemNum) {
  await driveEnsureSetup();
  const key = String(itemNum);
  if (driveCache.itemFolders[key]) return driveCache.itemFolders[key];
  const folderId = await driveFindOrCreateFolder(key, driveCache.photosId);
  driveCache.itemFolders[key] = folderId;
  return folderId;
}

async function driveGetFolderPhotos(folderLink) {
  const match = (folderLink || '').match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const folderId = match[1];
  if (!accessToken) return null;
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&orderBy=name`);
    if (res.error) { console.warn('Drive photo fetch error:', res.error); return null; }
    return (res.files || []).map(function(f) {
      return {
        id: f.id,
        name: f.name,
        // Use authenticated media download URL — fetch as blob in loadThumb()
        mediaUrl: 'https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media',
        view: 'https://drive.google.com/file/d/' + f.id + '/view',
      };
    });
  } catch(e) { console.error('driveGetFolderPhotos:', e); return null; }
}

// Fetch a Drive file as an authenticated blob URL for use in <img loading="lazy" src>
const _blobCache = {};
async function loadDriveThumb(fileId, imgEl, containerEl) {
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

async function driveUploadItemPhoto(file, itemNum, viewAbbr, inventoryId) {
  console.log('[Drive] Uploading photo:', itemNum, viewAbbr, 'invId:', inventoryId || 'none', 'file:', file.name, 'size:', file.size);
  await driveEnsureSetup();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `${itemNum} ${viewAbbr}.${ext}`;
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

const CONFIG_FILENAME = 'boxcar-files-config.json';

async function driveReadConfig(retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  try {
    // Search for config file in Drive root
    const q = encodeURIComponent(`name='${CONFIG_FILENAME}' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&spaces=drive`);
    if (!res.files || res.files.length === 0) return null;
    // Read file contents
    const fileId = res.files[0].id;
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
    // Search by prefix to find any user's sheet regardless of their name
    const q = encodeURIComponent(`name contains 'The Boxcar Files -' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&spaces=drive`);
    if (res.files && res.files.length > 0) {
      return res.files[0].id;
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
    const q = encodeURIComponent(`name='${CONFIG_FILENAME}' and trashed=false`);
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

