// ═══════════════════════════════════════════════════════════════
// migration-config.js — Item migration between master-sheet tabs.
//
// Admin-only tool for correcting misclassified items (e.g. an item
// sitting in MPC-Modern that should really be in Atlas O).
//
// All copy + routing rules live in MIGRATION. UI rendering lives in
// migration-ui.js. Sheet writes use the existing sheets.js helpers.
// ═══════════════════════════════════════════════════════════════

const MIGRATION = {
  // Turn the admin button on/off globally. Admin check inside migrateXxx
  // still applies regardless.
  enabled: true,

  // Source → list of allowed destinations. Only tabs present in
  // ERA_TABS (config.js) will show up as live options.
  routes: {
    'MPC-Modern':         ['Atlas O'],
    'Atlas O':            ['MPC-Modern'],
    'Lionel PW - Items':  [],         // never migrate PW
    'Pre-War':            [],         // never migrate Pre-War
  },

  // UI copy — edit here, not in migration-ui.js
  ui: {
    adminButtonLabel:  'Move Item Between Tabs',
    adminButtonHint:   'Fix misclassified items — moves one row from one master-sheet tab to another.',
    modalTitle:        'Move Item Between Tabs',
    sourceLabel:       'From tab',
    itemNumLabel:      'Item number',
    destLabel:         'To tab',
    findButton:        'Find item',
    previewTitle:      'Preview',
    previewTemplate:   'Found item {itemNum} at row {rowNum} in "{sourceTab}". Description: {description}',
    readyTemplate:     'Ready to append a copy into "{destTab}". The source row will NOT be cleared until you confirm step 2.',
    appendButton:      'Append to {destTab} \u2192',
    appendedTemplate:  '\u2713 Appended to "{destTab}" at row {rowNum}. Source row in "{sourceTab}" at row {sourceRow} is still in place.',
    clearPromptText:   'Clear the source row in "{sourceTab}" now? This removes it from the original tab.',
    clearButton:       'Clear source row',
    leaveButton:       'Leave source (keeps duplicate)',
    doneTemplate:      '\u2713 Source row cleared. Master-data cache wiped so next load will pick up the change.',
    cancelButton:      'Cancel',
    closeButton:       'Close',

    errNoItem:         'Item "{itemNum}" not found in "{sourceTab}".',
    errRouteDenied:    'Route not allowed: {sourceTab} \u2192 {destTab}.',
    errDisabled:       'Migration feature is disabled (MIGRATION.enabled=false).',
    errNotAdmin:       'Admin-only feature.',
    errDuplicate:      'Item "{itemNum}" already exists in "{destTab}" \u2014 duplicate move refused.',
    errGeneric:        'Migration failed: {message}',
  },
};

window.MIGRATION = MIGRATION;

// ──────────────────────────────────────────────────────────────
// Low-level helpers — each does ONE step so the UI can walk the user
// through Preview → Append → Clear deliberately, no atomic execution.
// ──────────────────────────────────────────────────────────────

// Small utility: replace {keys} in a template with values from an object.
function _migFill(tmpl, vals) {
  return String(tmpl || '').replace(/\{(\w+)\}/g, function(_, k) {
    return vals && vals[k] != null ? String(vals[k]) : '';
  });
}
window._migFill = _migFill;

// Normalize item numbers the same way app.js does. Falls back to a
// simple trim-uppercase if normalizeItemNum is unavailable for any reason.
function _migNormalize(n) {
  if (typeof normalizeItemNum === 'function') return normalizeItemNum(n);
  return String(n == null ? '' : n).trim().toUpperCase();
}

function _migRouteAllowed(sourceTab, destTab) {
  var routes = (window.MIGRATION && window.MIGRATION.routes) || {};
  var allowed = routes[sourceTab] || [];
  return allowed.indexOf(destTab) >= 0;
}

function _migAdminOk() {
  return (typeof _isAdmin === 'function') && _isAdmin();
}

// ── Step 1: Find the item in the source tab. Returns preview data.
async function migrationFindItem(itemNum, sourceTab, destTab) {
  var cfg = window.MIGRATION || {};
  if (!cfg.enabled)          throw new Error(_migFill(cfg.ui.errDisabled, {}));
  if (!_migAdminOk())        throw new Error(_migFill(cfg.ui.errNotAdmin, {}));
  if (!_migRouteAllowed(sourceTab, destTab))
    throw new Error(_migFill(cfg.ui.errRouteDenied, { sourceTab: sourceTab, destTab: destTab }));

  var sheetId = state.masterSheetId || (typeof MASTER_SHEET_ID !== 'undefined' ? MASTER_SHEET_ID : '');
  if (!sheetId) throw new Error('No master sheet ID — cannot find item');

  // Fetch source tab data
  var sourceRes = await sheetsGet(sheetId, sourceTab + '!A2:U');
  var rows = sourceRes.values || [];
  var normTarget = _migNormalize(itemNum);
  var idx = rows.findIndex(function(r) {
    return r && r[0] && _migNormalize(r[0]) === normTarget;
  });
  if (idx < 0) throw new Error(_migFill(cfg.ui.errNoItem, { itemNum: itemNum, sourceTab: sourceTab }));
  var sourceRow      = rows[idx];
  var sourceRowNumber = idx + 2;    // data starts at row 2

  // Duplicate check — refuse if destination already has this item
  var destRes = await sheetsGet(sheetId, destTab + '!A2:A');
  var destItemNums = (destRes.values || []).map(function(r) { return r && r[0]; }).filter(Boolean);
  var dup = destItemNums.some(function(i) { return _migNormalize(i) === normTarget; });
  if (dup) throw new Error(_migFill(cfg.ui.errDuplicate, { itemNum: itemNum, destTab: destTab }));

  return {
    itemNum:         sourceRow[0],
    description:     sourceRow[7] || sourceRow[6] || sourceRow[1] || '(no description)',
    variation:       sourceRow[10] || '',
    roadName:        sourceRow[6] || '',
    sourceRow:       sourceRow,
    sourceRowNumber: sourceRowNumber,
    sourceTab:       sourceTab,
    destTab:         destTab,
  };
}
window.migrationFindItem = migrationFindItem;

// ── Step 2: Append the row to the destination tab. Returns row number.
async function migrationAppendToDest(sourceRow, destTab) {
  var cfg = window.MIGRATION || {};
  if (!cfg.enabled)   throw new Error(_migFill(cfg.ui.errDisabled, {}));
  if (!_migAdminOk()) throw new Error(_migFill(cfg.ui.errNotAdmin, {}));
  var sheetId = state.masterSheetId || (typeof MASTER_SHEET_ID !== 'undefined' ? MASTER_SHEET_ID : '');

  // Use sheetsUpdate to write to a specific range — master data starts row 2
  var colARes = await sheetsGet(sheetId, destTab + '!A2:A');
  var nextRow = 2 + ((colARes.values || []).length);
  var writeRange = destTab + '!A' + nextRow + ':U' + nextRow;
  await sheetsUpdate(sheetId, writeRange, [sourceRow]);
  return nextRow;
}
window.migrationAppendToDest = migrationAppendToDest;

// ── Step 3: Clear / delete the source row.
async function migrationClearSource(sourceTab, sourceRowNumber) {
  var cfg = window.MIGRATION || {};
  if (!cfg.enabled)   throw new Error(_migFill(cfg.ui.errDisabled, {}));
  if (!_migAdminOk()) throw new Error(_migFill(cfg.ui.errNotAdmin, {}));
  var sheetId = state.masterSheetId || (typeof MASTER_SHEET_ID !== 'undefined' ? MASTER_SHEET_ID : '');
  await sheetsDeleteRow(sheetId, sourceTab, sourceRowNumber);
  // Wipe master cache so next load re-fetches
  try { idbRemove('lv_master_cache'); } catch(e){}
  try { localStorage.removeItem('lv_master_cache_ts'); } catch(e){}
  return true;
}
window.migrationClearSource = migrationClearSource;

// Back-compat stub (older callers) — wraps the 3 steps with no pauses.
// Not recommended — use the 3-step flow above for safety.
window.migrateItemBetweenTabs = async function(itemNum, sourceTab, destTab) {
  var prev = await migrationFindItem(itemNum, sourceTab, destTab);
  var destRowNum = await migrationAppendToDest(prev.sourceRow, destTab);
  await migrationClearSource(sourceTab, prev.sourceRowNumber);
  return { moved: true, destRowNum: destRowNum, sourceRowNumber: prev.sourceRowNumber };
};
