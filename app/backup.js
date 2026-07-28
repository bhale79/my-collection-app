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
  // Restore strings
  restoreConfirmTitle: 'Restore from backup?',
  restoreConfirmBody:  'Your current collection will be saved as an automatic backup first, then replaced with this snapshot. You can undo this restore by restoring the "before-restore" backup.',
  restoreConfirmOk:    'Restore',
  restoreSavingNow:    'Saving your current state…',
  restoreCopying:      'Copying backup into place…',
  restoreSwapping:     'Switching to restored sheet…',
  restoreReloading:    'Reloading your collection…',
  restoreSuccess:      'Restore complete! Your previous state is saved.',
  restoreFailed:       'Restore failed: ',
  restoreRevertedNote: '(your sheet was not changed)',
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


// Restore from a backup. The careful one — multi-step with rollback.
// Returns the new personal sheet ID on success.
async function backupRestore(backupId, opts) {
  opts = opts || {};
  if (!backupId) throw new Error('No backup ID');
  if (!state || !state.personalSheetId) {
    throw new Error(BACKUP_UI_TEXT.notSignedIn);
  }
  if (typeof driveRequest !== 'function') {
    throw new Error('Drive not initialized');
  }

  const oldPersonalId = state.personalSheetId;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function(){};

  // Step A: Auto-snapshot current state (safety net)
  onProgress(BACKUP_UI_TEXT.restoreSavingNow);
  let preRestoreSnapshot = null;
  try {
    preRestoreSnapshot = await backupCreateAuto('before-restore');
    console.log('[Restore] Pre-restore snapshot:', preRestoreSnapshot.name);
  } catch (e) {
    // Auto-snapshot is required — without it, restore is too dangerous
    throw new Error('Could not save pre-restore snapshot: ' + (e.message || e));
  }

  // Step B: Copy the backup into the vault folder (NOT the Backups subfolder)
  // The copy becomes the new active personal sheet.
  onProgress(BACKUP_UI_TEXT.restoreCopying);
  await driveEnsureSetup();
  const personalSheetName = (typeof _getPersonalSheetName === 'function')
    ? _getPersonalSheetName()
    : 'The Rail Roster - Restored Collection';

  let copied;
  try {
    copied = await driveRequest(
      'POST',
      '/files/' + backupId + '/copy?fields=id,name',
      { name: personalSheetName, parents: [driveCache.vaultId] }
    );
  } catch (e) {
    throw new Error(BACKUP_UI_TEXT.restoreFailed + (e.message || e) +
      ' ' + BACKUP_UI_TEXT.restoreRevertedNote);
  }
  if (!copied || !copied.id) {
    throw new Error(BACKUP_UI_TEXT.restoreFailed + 'Drive copy returned no ID ' +
      BACKUP_UI_TEXT.restoreRevertedNote);
  }
  const newPersonalId = copied.id;
  console.log('[Restore] New active sheet:', newPersonalId);

  // Step C: Move the OLD personal sheet into the Backups folder, renamed
  onProgress(BACKUP_UI_TEXT.restoreSwapping);
  try {
    const backupsFolderId = await _backupGetFolderId();
    const replacedName = 'Replaced by restore - ' + _bkpTimestamp() + ' - (was active)';
    // Find old sheet's current parent
    const oldMeta = await driveRequest('GET', '/files/' + oldPersonalId + '?fields=parents');
    const oldParents = (oldMeta && oldMeta.parents) ? oldMeta.parents.join(',') : driveCache.vaultId;
    await driveRequest(
      'PATCH',
      '/files/' + oldPersonalId + '?addParents=' + backupsFolderId +
        '&removeParents=' + oldParents + '&fields=id',
      { name: replacedName }
    );
  } catch (e) {
    console.warn('[Restore] Old sheet rename/move failed (non-fatal):', e);
    // Non-fatal — the old sheet stays where it was, but we still switch.
  }

  // Step D: Point the app at the new sheet
  state.personalSheetId = newPersonalId;
  localStorage.setItem('lv_personal_id', newPersonalId);
  if (typeof driveWriteConfig === 'function') {
    try {
      await driveWriteConfig({
        personalSheetId: newPersonalId,
        vaultId: driveCache.vaultId,
        photosId: driveCache.photosId,
        soldPhotosId: driveCache.soldPhotosId,
      });
    } catch (e) {
      console.warn('[Restore] Config update failed (non-fatal):', e);
    }
  }

  // Step E: Reload personal data
  onProgress(BACKUP_UI_TEXT.restoreReloading);
  if (typeof loadPersonalData === 'function') {
    try { await loadPersonalData(); } catch (e) { console.warn('[Restore] Reload failed:', e); }
  }

  // Invalidate cached list so next View shows the new auto-backup
  backupCache.lastList = null;
  backupCache.lastListAt = 0;

  return { newPersonalSheetId: newPersonalId, preRestoreBackup: preRestoreSnapshot };
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
    '<div class="rr-card rr-card-flex" style="padding:0">' +
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
        '' +
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
              'style="font-size:0.78rem;color:var(--text-dim,#777);text-decoration:none;' +
              'padding:0.35rem 0.6rem;border:1px solid var(--border,#ddd);' +
              'border-radius:6px">Open</a>' +
            '<button onclick="uiBackupRestore(\'' + f.id + '\', \'' + (f.name||'').replace(/\'/g,"\\\'") + '\')" ' +
              'style="font-size:0.78rem;color:#fff;background:var(--accent,#4a7);border:none;' +
              'padding:0.4rem 0.7rem;border-radius:6px;cursor:pointer;font-weight:600">Restore</button>' +
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

// Wired to the Restore button in the View Backups modal.
async function uiBackupRestore(backupId, backupName) {
  // Confirmation dialog
  const useNative = (typeof appConfirm !== 'function');
  const confirmMsg = BACKUP_UI_TEXT.restoreConfirmBody +
    '\n\nBackup: ' + (backupName || backupId);
  let ok = false;
  if (useNative) {
    ok = window.confirm(BACKUP_UI_TEXT.restoreConfirmTitle + '\n\n' + confirmMsg);
  } else {
    ok = await appConfirm(confirmMsg, {
      title: BACKUP_UI_TEXT.restoreConfirmTitle,
      ok: BACKUP_UI_TEXT.restoreConfirmOk,
      danger: true,
    });
  }
  if (!ok) return;

  // Close the list modal so progress shows clearly
  const listModal = document.getElementById('backup-list-modal');
  if (listModal) listModal.remove();

  // Build progress modal
  let prog = document.getElementById('backup-progress-modal');
  if (prog) prog.remove();
  prog = document.createElement('div');
  prog.id = 'backup-progress-modal';
  prog.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;' +
    'display:flex;align-items:center;justify-content:center;padding:1rem';
  prog.innerHTML =
    '<div class="rr-card" style="text-align:center">' +
      '<div style="font-weight:700;font-size:1rem;margin-bottom:0.75rem">Restoring…</div>' +
      '<div id="backup-progress-msg" style="font-size:0.9rem;color:var(--text-dim,#777)">Starting…</div>' +
    '</div>';
  document.body.appendChild(prog);
  const msgEl = document.getElementById('backup-progress-msg');

  try {
    const result = await backupRestore(backupId, {
      onProgress: function(m) { if (msgEl) msgEl.textContent = m; },
    });
    // Done — replace progress with success
    prog.remove();
    const successName = (result.preRestoreBackup && result.preRestoreBackup.name) || '';
    let done = document.createElement('div');
    done.id = 'backup-progress-modal';
    done.style.cssText = prog.style.cssText;
    done.innerHTML =
      '<div class="rr-card" style="text-align:center">' +
        '<div style="font-weight:700;font-size:1.05rem;margin-bottom:0.5rem;color:var(--accent,#4a7)">' +
          BACKUP_UI_TEXT.restoreSuccess + '</div>' +
        (successName
          ? '<div style="font-size:0.82rem;color:var(--text-dim,#777);margin-bottom:1rem">' +
            'Your previous state: <br><strong>' + successName + '</strong></div>'
          : '') +
        '<button onclick="document.getElementById(\'backup-progress-modal\').remove();' +
          'if(typeof showPage===\'function\') showPage(\'dashboard\',null);" ' +
          'style="background:var(--accent,#4a7);color:#fff;border:none;padding:0.6rem 1.5rem;' +
          'border-radius:8px;font-weight:600;cursor:pointer">Done</button>' +
      '</div>';
    document.body.appendChild(done);
  } catch (e) {
    console.error('[Restore] Failed:', e);
    prog.remove();
    if (typeof showToast === 'function') {
      showToast(BACKUP_UI_TEXT.restoreFailed + (e.message || 'unknown'));
    } else {
      window.alert(BACKUP_UI_TEXT.restoreFailed + (e.message || 'unknown'));
    }
  }
}

// ── 6. EXPOSE GLOBALS ─────────────────────────────────────────
window.backupCreate     = backupCreate;
window.backupCreateAuto = backupCreateAuto;
window.backupList       = backupList;
window.backupDelete     = backupDelete;
window.uiBackupNow      = uiBackupNow;
window.uiBackupList     = uiBackupList;
window.backupRestore    = backupRestore;
window.uiBackupRestore  = uiBackupRestore;
window.BACKUP_CONFIG    = BACKUP_CONFIG;
window.BACKUP_UI_TEXT   = BACKUP_UI_TEXT;
