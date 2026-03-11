// ============================================================
//  My Collection App — Health Check
//  Paste this entire block into your browser console while
//  the app is open. It will print a wiring report in ~2 seconds.
//  Last updated: Session 50
// ============================================================

(function() {
  const OK  = '✅';
  const ERR = '❌';
  const WARN = '⚠️';
  const results = [];

  function pass(label, detail) { results.push({ s: OK,   l: label, d: detail }); }
  function fail(label, detail) { results.push({ s: ERR,  l: label, d: detail }); }
  function warn(label, detail) { results.push({ s: WARN, l: label, d: detail }); }

  // ── 1. Core functions exist ───────────────────────────────────
  const coreFns = [
    'showPage', 'renderBrowse', 'buildDashboard', 'buildWantPage',
    'buildForSalePage', 'buildSoldPage', 'buildQuickEntryList',
    'showItemDetailPage', 'updateCollectionItem', 'removeCollectionItem',
    'loadPersonalData', 'sheetsAppend', 'sheetsDeleteRow',
    'driveUploadItemPhoto', 'driveEnsureSetup',
    'collectionActionForSale', 'collectionActionSold',
    'showAddToUpgradeModal',
  ];
  coreFns.forEach(fn => {
    if (typeof window[fn] === 'function') pass(fn + '()');
    else fail(fn + '()', 'NOT FOUND — may be broken or renamed');
  });

  // ── 2. Wizard functions exist ─────────────────────────────────
  const wizardFns = [
    'quickEntryAdd', 'closeWizard', 'saveItem', 'launchWizard',
    'launchSetItemWizard', '_showQuickEntryMultiUI',
  ];
  wizardFns.forEach(fn => {
    if (typeof window[fn] === 'function') pass(fn + '()');
    else fail(fn + '()', 'NOT FOUND — wizard.js may not have loaded');
  });

  // ── 3. Vault functions exist ──────────────────────────────────
  const vaultFns = [
    'vaultInit', 'vaultSubmitData', 'vaultIsOptedIn',
    'vaultRenderMarketCard', 'vaultRenderPrefsRow', 'vaultShowOptInModal',
  ];
  vaultFns.forEach(fn => {
    if (typeof window[fn] === 'function') pass(fn + '()');
    else warn(fn + '()', 'Not found — vault.js may not have loaded (non-critical)');
  });

  // ── 4. Tutorial functions exist ───────────────────────────────
  const tutFns = ['startTutorial', 'tutShowStep', 'tutDismiss'];
  tutFns.forEach(fn => {
    if (typeof window[fn] === 'function') pass(fn + '()');
    else warn(fn + '()', 'Not found — tutorial.js may not have loaded (non-critical)');
  });

  // ── 5. State object is populated ─────────────────────────────
  if (typeof state === 'undefined') {
    fail('state object', 'state is not defined — app.js likely failed to load');
  } else {
    pass('state object exists');

    if (state.personalSheetId)
      pass('state.personalSheetId', state.personalSheetId.substring(0,20) + '…');
    else
      fail('state.personalSheetId', 'null — user may not be signed in or config not found');

    if (state.masterData && state.masterData.length > 0)
      pass('state.masterData', state.masterData.length.toLocaleString() + ' items loaded');
    else
      fail('state.masterData', 'Empty or not loaded');

    if (state.personalData && Object.keys(state.personalData).length > 0)
      pass('state.personalData', Object.keys(state.personalData).length + ' personal items loaded');
    else
      warn('state.personalData', 'Empty — expected if collection is empty or not yet loaded');

    const filters = ['type','road','owned','search','quickEntry'];
    const missingFilters = filters.filter(f => !(f in (state.filters || {})));
    if (missingFilters.length === 0) pass('state.filters');
    else warn('state.filters', 'Missing keys: ' + missingFilters.join(', '));
  }

  // ── 6. Auth / token ──────────────────────────────────────────
  const token = localStorage.getItem('lv_token');
  const expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
  if (!token) {
    warn('accessToken', 'No token in localStorage — user may need to sign in');
  } else if (expiry < Date.now()) {
    warn('accessToken', 'Token is expired — will refresh on next action');
  } else {
    const mins = Math.round((expiry - Date.now()) / 60000);
    pass('accessToken', 'Valid for ~' + mins + ' more minutes');
  }

  // ── 7. Drive cache ────────────────────────────────────────────
  if (typeof driveCache !== 'undefined') {
    if (driveCache.photosId) pass('driveCache.photosId', driveCache.photosId);
    else warn('driveCache.photosId', 'Not set — Drive setup may not have run yet');
    if (driveCache.vaultId) pass('driveCache.vaultId', driveCache.vaultId);
    else warn('driveCache.vaultId', 'Not set');
  } else {
    fail('driveCache', 'Not defined — app.js may not have loaded');
  }

  // ── 8. localStorage keys ──────────────────────────────────────
  const lsKeys = [
    'lv_token', 'lv_personal_id', 'lv_vault_id',
    'lv_photos_id', 'lv_personal_cache_ts'
  ];
  const presentKeys = lsKeys.filter(k => !!localStorage.getItem(k));
  const missingKeys = lsKeys.filter(k => !localStorage.getItem(k));
  if (missingKeys.length === 0)
    pass('localStorage keys', 'All ' + lsKeys.length + ' expected keys present');
  else if (missingKeys.length <= 2)
    warn('localStorage keys', 'Missing: ' + missingKeys.join(', '));
  else
    fail('localStorage keys', 'Many missing: ' + missingKeys.join(', ') + ' — may need to sign in');

  // ── 9. Critical DOM elements ──────────────────────────────────
  const domIds = [
    'page-browse', 'page-dashboard', 'page-quickentry',
    'browse-tbody', 'result-count', 'page-info',
    'wizard-overlay',
  ];
  domIds.forEach(id => {
    if (document.getElementById(id)) pass('#' + id + ' DOM element');
    else fail('#' + id + ' DOM element', 'Not found in DOM — index.html may be out of sync');
  });

  // ── 10. Column mapping sanity check ──────────────────────────
  if (typeof state !== 'undefined' && state.personalData) {
    const samples = Object.values(state.personalData).filter(pd => pd.owned).slice(0, 3);
    if (samples.length) {
      const hasEstWorth = samples.some(pd => 'userEstWorth' in pd);
      const hasPhotoItem = samples.some(pd => 'photoItem' in pd);
      const hasCondition = samples.some(pd => 'condition' in pd);
      if (hasEstWorth) pass('personalData.userEstWorth field present');
      else warn('personalData.userEstWorth', 'Not found on any owned items — column mapping may be off');
      if (hasPhotoItem) pass('personalData.photoItem field present');
      else warn('personalData.photoItem', 'Not found — photo column may be wrong');
      if (hasCondition) pass('personalData.condition field present');
      else warn('personalData.condition', 'Not found');
    }
  }

  // ── Print report ──────────────────────────────────────────────
  const passes = results.filter(r => r.s === OK).length;
  const fails  = results.filter(r => r.s === ERR).length;
  const warns  = results.filter(r => r.s === WARN).length;

  console.group('%c My Collection App — Health Check Report', 'font-size:14px;font-weight:bold;color:#f05008');
  console.log('%c ' + passes + ' passed  |  ' + fails + ' failed  |  ' + warns + ' warnings',
    'font-size:12px;color:' + (fails > 0 ? '#e74c3c' : warns > 0 ? '#d4a843' : '#3a9e68'));
  console.log('─'.repeat(60));

  results.forEach(r => {
    const style = r.s === OK ? 'color:#3a9e68' : r.s === ERR ? 'color:#e74c3c;font-weight:bold' : 'color:#d4a843';
    if (r.d)
      console.log('%c' + r.s + ' ' + r.l, style, '\n    → ' + r.d);
    else
      console.log('%c' + r.s + ' ' + r.l, style);
  });

  console.log('─'.repeat(60));
  if (fails === 0 && warns === 0)
    console.log('%c All systems go! 🚂', 'color:#3a9e68;font-size:13px;font-weight:bold');
  else if (fails === 0)
    console.log('%c Minor warnings only — app should work normally', 'color:#d4a843');
  else
    console.log('%c ' + fails + ' critical issue(s) found — check ❌ items above', 'color:#e74c3c;font-weight:bold');

  console.groupEnd();
})();
