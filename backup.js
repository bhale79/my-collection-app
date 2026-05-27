// ============================================================
//  The Rail Roster — Backup Module
//  Session 155 (2026-05-27)
//
//  Provides manual snapshots of the user's personal sheet to a
//  dedicated Drive folder. Pairs with Restore (next push).
//
//  Depends on globals: driveRequest, driveFindOrCreateFolder,
//  driveEnsureSetup, driveCache, state, showToast
// ============================================================

// ── 1. CENTRALIZED CONFIG ─────────────────────────────────────
// Per stability rules: every value the team might want to tweak
// lives here. NEVER hardcode these strings elsewhere.
const BACKUP_CONFIG = {
  folderName: 'Backups',           // subfolder inside the vault
  filenamePrefix: 'Rail Roster Backup',
  timestampFormat: 'YYYY-MM-DD HH:mm',
  schemaVersion: 'v1.0',           // bump when personal sheet schema changes
  retentionPolicy: 'keep-all',     // 'keep-all' | 'rolling-30-day' (future)
};

// All user-facing strings — single place for copy edits / future i18n
const BACKUP_UI_TEXT = {
  creatingToast:  'Creating backup…',
  successToast:   'Backup saved: ',
  errorToast:     'Backup failed: ',
  noVaultError:   'Drive setup not ready. Try again in a moment.',
  notSignedIn:    'Sign in to back up your collection.',
  listEmpty:      'No backups yet. Tap "Back Up Now" to create one.',
  listLoadError:  'Could not load your backups.',
  defaultLabel:   'manual',
  autoLabelPrefix:'auto-',
};

// ── 2. STATE ──────────────────────────────────────────────────
var backupCache = {
  folderId: null,        // ID of the Backups subfolder (cached)
  lastList: null,        // last fetched list, for UI
  lastListAt: 0,         // timestamp of last list fetch (ms)
};

// ── 3. INTERNAL HELPERS ───────────────────────────────────────

// Format a date as "2026-05-27 14:32" — used in backup filenames
function _bkpTimestamp(d) {
  d = d || new Date();
  function p(n) { return String(n).padStart(2, '0'); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
         ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// Friendlier "X minutes ago" / "2 days ago" for the backup list UI
function _bkpRelativeTime(isoString) {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  if (!then) return '';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + ' min ago';
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + ' hr ago';
  const days = Math.round(hr / 24);
  if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  const months = Math.round(days / 30);
  return months + ' month' + (months === 1 ? '' : 's') + ' ago';
}

// Format bytes as a human-readable size (used in list UI)
function _bkpFormatSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const n = parseInt(bytes, 10);
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

// Get (and cache) the Backups folder inside the vault.
// Creates the folder on first call.
async function _backupGetFolderId() {
  if (backupCache.folderId) return backupCache.folderId;

  await driveEnsureSetup();
  if (!driveCache.vaultId) {
    throw new Error(BACKUP_UI_TEXT.noVaultError);
  }

  const folderId = await driveFindOrCreateFolder(
    BACKUP_CONFIG.folderName,
    driveCache.vaultId
  );
  backupCache.folderId = folderId;
  return folderId;
}

// ── 4. PUBLIC API ─────────────────────────────────────────────

// Manual snapshot. Returns { id, name } on success, throws on failure.
async function backupCreate(label) {
  if (!state || !state.personalSheetId) {
    throw new Error(BACKUP_UI_TEXT.notSignedIn);
  }

  const folderId = await _backupGetFolderId();
  const lbl = (label || BACKUP_UI_TEXT.defaultLabel).trim();
  const name = BACKUP_CONFIG.filenamePrefix +
               ' - ' + _bkpTimestamp() +
               ' - ' + lbl;

  // Drive's copy endpoint: POST /files/{id}/copy with metadata in body
  const copied = await driveRequest(
    'POST',
    '/files/' + state.personalSheetId + '/copy?fields=id,name,createdTime,size',
    { name: name, parents: [folderId] }
  );

  if (!copied || !copied.id) {
    throw new Error('Drive copy returned no ID');
  }

  // Invalidate list cache so next View shows the new backup
  backupCache.lastList = null;
  backupCache.lastListAt = 0;

  console.log('[Backup] Created:', name, copied.id);
  return { id: copied.id, name: copied.name || name };
}

// Auto snapshot — called by the app before destructive ops.
// `reason` becomes part of the filename label, e.g. "before-import".
async function backupCreateAuto(reason) {
  const label = BACKUP_UI_TEXT.autoLabelPrefix + (reason || 'unknown');
  return backupCreate(label);
}

// List all backups in the Backups folder, newest first.
async function backupList() {
  const folderId = await _backupGetFolderId();

  // Drive Files API: query files in folder, sheets only, not trashed
  const q = encodeURIComponent(
    "'" + folderId + "' in parents and " +
    "mimeType='application/vnd.google-apps.spreadsheet' and " +
    "trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,createdTime,size,modifiedTime)');
  const res = await driveRequest(
    'GET',
    '/files?q=' + q + '&fields=' + fields + '&orderBy=createdTime desc&pageSize=200'
  );

  const files = (res && res.files) || [];
  backupCache.lastList = files;
  backupCache.lastListAt = Date.now();
  return files;
}

// Delete a backup permanently (moves to Drive trash — user can recover for 30 days)
async function backupDelete(backupId) {
  if (!backupId) throw new Error('No backup ID');
  await driveRequest('DELETE', '/files/' + backupId);
  backupCache.lastList = null;
  backupCache.lastListAt = 0;
  console.log('[Backup] Deleted:', backupId);
}

// ── 5. UI INTEGRATION ─────────────────────────────────────────

// Wired to the "Back Up Now" button in prefs.js
async function uiBackupNow() {
  try {
    if (typeof showToast === 'function') showToast(BACKUP_UI_TEXT.creatingToast);
    const result = await backupCreate(BACKUP_UI_TEXT.defaultLabel);
    if (typeof showToast === 'function') {
      showToast(BACKUP_UI_TEXT.successToast + result.name);
    }
  } catch (e) {
    console.error('[Backup] uiBackupNow failed:', e);
    if (typeof showToast === 'function') {
      showToast(BACKUP_UI_TEXT.errorToast + (e.message || 'unknown error'));
    }
  }
}

// Wired to the "View Backups" button in prefs.js — opens a modal
async function uiBackupList() {
  // Build modal shell
  let modal = document.getElementById('backup-list-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'backup-list-modal';
  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;' +
    'display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML =
    '<div style="background:var(--surface,#fff);color:var(--text,#111);' +
      'border-radius:12px;max-width:680px;width:100%;max-height:85vh;' +
      'display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.4)">' +
      '<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border,#ddd);' +
        'display:flex;align-items:center;justify-content:space-between">' +
        '<strong style="font-size:1.05rem">Your Backups</strong>' +
        '<button onclick="document.getElementById(\'backup-list-modal\').remove()" ' +
          'style="background:none;border:none;color:var(--text,#111);' +
          'font-size:1.5rem;cursor:pointer;line-height:1;padding:0 0.25rem">×</button>' +
      '</div>' +
      '<div id="backup-list-body" style="padding:1rem 1.25rem;overflow:auto;flex:1">' +
        '<div style="text-align:center;color:var(--text-dim,#777);padding:2rem 0">' +
          'Loading…</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  // Click outside to close
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });

  // Fetch and render
  const body = document.getElementById('backup-list-body');
  try {
    const files = await backupList();
    if (!files.length) {
      body.innerHTML =
        '<div style="text-align:center;color:var(--text-dim,#777);padding:2rem 0">' +
        BACKUP_UI_TEXT.listEmpty + '</div>';
      return;
    }
    body.innerHTML =
      '<div style="font-size:0.85rem;color:var(--text-dim,#777);margin-bottom:0.75rem">' +
        files.length + ' backup' + (files.length === 1 ? '' : 's') +
        ' &middot; Restore button coming in next update' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:0.5rem">' +
        files.map(function(f) {
          return '<div style="display:flex;align-items:center;gap:0.75rem;' +
            'padding:0.65rem 0.75rem;background:var(--surface-alt,#f7f7f7);' +
            'border-radius:8px;border:1px solid var(--border,#e5e5e5)">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-weight:600;font-size:0.9rem;word-break:break-word">' +
                (f.name || 'Unnamed backup') + '</div>' +
              '<div style="font-size:0.75rem;color:var(--text-dim,#777);margin-top:0.15rem">' +
                _bkpRelativeTime(f.createdTime) +
                (f.size ? ' &middot; ' + _bkpFormatSize(f.size) : '') +
              '</div>' +
            '</div>' +
            '<a href="https://docs.google.com/spreadsheets/d/' + f.id + '" ' +
              'target="_blank" rel="noopener" ' +
              'style="font-size:0.78rem;color:var(--accent,#4a7);text-decoration:none;' +
              'padding:0.35rem 0.6rem;border:1px solid var(--border,#ddd);' +
              'border-radius:6px">Open</a>' +
          '</div>';
        }).join('') +
      '</div>';
  } catch(e) {
    console.error('[Backup] List failed:', e);
    body.innerHTML =
      '<div style="text-align:center;color:#c44;padding:2rem 0">' +
      BACKUP_UI_TEXT.listLoadError + '<br><span style="font-size:0.8rem;color:var(--text-dim)">' +
      (e.message || '') + '</span></div>';
  }
}

// ── 6. EXPOSE GLOBALS ─────────────────────────────────────────
window.backupCreate     = backupCreate;
window.backupCreateAuto = backupCreateAuto;
window.backupList       = backupList;
window.backupDelete     = backupDelete;
window.uiBackupNow      = uiBackupNow;
window.uiBackupList     = uiBackupList;
window.BACKUP_CONFIG    = BACKUP_CONFIG;
window.BACKUP_UI_TEXT   = BACKUP_UI_TEXT;
