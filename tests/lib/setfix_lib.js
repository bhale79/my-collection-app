#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SETFIX — 2026-11-08 (real Chromium, the REAL app)
// PLAN_2026-11-07_TESTING_FIXES.md items 4 and 3, from Brad's hand-tests
// T-2026-11-04-05 and T-2026-11-05-02.
//
// Item 4 — "Use the one I have" linked the engine before the set was finished.
//   Seen: adding catalog set 2124W, "You already have a 2332" → Use the one I
//   have → "2332 joined Set 2124W" — the 2332 got the set's Group ID at once,
//   three cars before the set saved. PROVED here on the old code (planted P1):
//   cancelling the walk then DELETED that engine and its box ("Yes, Delete All"
//   removes every row with the set's Group ID — rrRemoveSetGroup).
//   Now: the pick is only CHECKED (rrLinkOwnedToGroup, checkOnly) and the copy
//   joins the set when saveSet has written the set's My Sets row
//   (rrSetLinkUsedOwned, once — d._setOwnedLinked; saveSet holds _setSaveLock).
//     W1  the pick writes nothing; the copy keeps its own group; the walk moves on
//     W2  a pick the stamp would refuse (not on the sheet yet) falls through to the
//         Add steps, as before, and is not remembered
//     W3  Cancel mid-walk: only the piece the walk ADDED is deleted; the engine and
//         its box stay, untouched; the question counts 1 and names the 2332 that stays
//     W4  Discard / close with only the engine picked: no "Delete All" question,
//         nothing deleted, nothing written, not an "Unfinished set entry"
//     W5  Save: the My Sets row is written first, THEN engine + box + sheet join
//     W6  double Save: one My Sets row, each piece written once
//     W7  a second link call (re-entry / double) writes nothing and refuses nothing
//     W8  the set's row fails to save: the engine is not linked
//     W9  the copy went into another set meanwhile: the set saves, the toast says
//         the 2332 did not join
//     W10 (same root, coordinator) a set walk started from an item page's "Add
//         Another Item" runs under THAT item's group. The real saveWizardItem
//         records only the row it added (d._setAddedKeys); Cancel names it and
//         deletes only it — the item the walk started from and its box stay.
//         PROVED on the old code (planted P19): the cancel deleted them too.
//     W11 "Yes, Delete All" pressed twice deletes once
//
// Item 3 — Removing a set.
//     R1  removed from its page (opened from My Sets), the page closes and My Sets
//         shows — computer and phone
//     R2  the question: the set's name, "pieces stay in your collection either
//         way", exactly two choices, "Keep the pieces grouped" picked; no
//         "remove the pieces" anywhere
//     R3  "Keep": every piece keeps its Group ID; nothing written to them; not
//         called an "Unfinished set entry" afterwards (an account setting remembers
//         it); a real unfinished walk is still flagged
//     R4  "Break up": cleared through the app's own _breakUpGroup (pieces + sheet),
//         all pieces still in the collection; page closes (opened from My Collection)
//     R5  a set with no pieces: says only its entry goes; no choice
//     R6  Cancel: nothing changes, the page stays
//     R7  the sheet refuses: the set comes back, the pieces are untouched
//     R8  removed from the LIST (not its page): no page change
//   S  source: words in config.js; _removeOwnedSet never deletes a piece
//   P  PLANTED offenders — each must turn its check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  the setfix suites need playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1400, height: 900 };
const TYPES = { js: 'application/javascript', css: 'text/css', html: 'text/html' };
const sleep = (pg, ms) => pg.waitForTimeout(ms);

async function open(browser, viewport, planted) {
  const pg = await browser.newPage({ viewport });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: TYPES[name.split('.').pop()] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    // Stand-ins for the Google writers — they RECORD, nothing leaves the page.
    window.__w = { updates: [], appends: [], deletes: [], removes: [], toasts: [], seq: 0, appendFail: false, removeOk: true };
    const W = window.__w;
    window.rrRowStillIs = async () => true;
    window.rrWhereIsRow = async (id, tab, row) => ({ ok: true, row: row });
    window.rrVerifiedRowUpdate = async (id, tab, row, range, vals) => { W.updates.push({ tab, row, range, v: vals[0][0], seq: ++W.seq }); return true; };
    window.sheetsAppend = async (id, range, rows) => {
      if (W.appendFail && /My Sets/.test(range)) throw new Error('offline (test)');
      W.appends.push({ range, row: rows[0], seq: ++W.seq }); return 300 + W.appends.length;
    };
    window.sheetsDeleteRow = async (id, tab, row) => { W.deletes.push({ tab, row, seq: ++W.seq }); return row; };
    window.rrRemoveRowConfirmed = async (id, tab, row, range) => { W.removes.push({ tab, row, range, seq: ++W.seq }); return W.removeOk; };
    window.driveEnsureSetup = async () => {};
    window.driveUploadPhoto = async () => ({});
    window.rrDiscardAddUploads = async () => {};
    window.buildDashboard = () => {};
    window.showToast = (m) => { W.toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    window._cachePersonalData = () => {};
    window.rrSaveMissed = (e, what) => { W.toasts.push('MISSED ' + what); };
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    if (typeof _initBackButton === 'function') _initBackButton();
    const mk = (n, t, yr) => ({ itemNum: n, variation: '', itemType: t, _era: 'pw', _tab: 'Lionel PW - Items', yearProd: yr, description: t + ' ' + n, roadName: 'Pennsylvania' });
    state.masterData = [mk('2332', 'Electric', '1947'), mk('2625', 'Passenger Car', '1947'), mk('6457', 'Caboose', '1949')];
    _rebuildMasterIndex();
    state.setData = [{ setNum: '2124W', setName: 'Passenger Set', year: '1947', gauge: 'O', items: ['2332', '2625', '2625', '2625'], alts: [], notes: '', _era: 'pw' }];
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {};
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
  });
  return { pg, errs };
}

// ── ITEM 4: the set walk ────────────────────────────────────────────────────
async function walkScenario(pg, part) {
  return pg.evaluate(async (part) => {
    const R = {}; const W = window.__w;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const GID = 'SET-2124W-NEW';
    const pd = (n, inv, row, x) => Object.assign({ owned: true, itemNum: n, variation: '', inventoryId: inv, row: row, era: 'pw', manufacturer: 'Lionel' }, x);
    function seed() {
      state.personalData = {
        kE:  pd('2332', '100', 5, { groupId: 'GRP-E', condition: '8' }),     // Brad's 2332 (inventory 100) with its box
        kEb: pd('2332-BOX', '101', 6, { groupId: 'GRP-E' }),
        kP:  pd('2625', '102', 99999, { groupId: '' }),                      // a 2625 not on the sheet yet
      };
      state.isData = { i1: { sheetNum: '2332-IS', linkedItem: '2332', groupId: 'GRP-E', row: 4, inventoryId: 'I1', owned: true } };
      state.mySetsData = {};
      W.updates.length = 0; W.appends.length = 0; W.deletes.length = 0; W.toasts.length = 0; W.appendFail = false;
    }
    const setData = () => ({
      tab: 'set', _resolvedSet: { setNum: '2124W', setName: 'Passenger Set', year: '1947', items: ['2332', '2625', '2625', '2625'], alts: [] },
      _setFinalItems: ['2332', '2625', '2625', '2625'], _setGroupId: GID, _setItemIndex: 0, _setItemsSaved: [],
      _setEntryMode: 'full', entryMode: 'full', _setCondition: 7, _setWorth: '100',
    });
    async function startAndUseEngine() {
      _buildWizardModal();
      document.getElementById('wizard-modal').classList.add('open');
      wizard = { step: 0, tab: 'set', data: setData(), steps: getSteps('set'), matchedItem: null };
      launchSetItemWizard();
      await sleep(50);
      const ask = document.getElementById('rr-set-owned-ask');
      const use = ask && ask.querySelector('button[data-use="kE"]');
      if (use) use.click();
      for (let i = 0; i < 40 && wizard.data._setItemIndex !== 1; i++) await sleep(25);
      await sleep(80);
      return !!use;
    }
    // a piece the walk ADDS — what saveWizardItem leaves behind (row + state + the count)
    // (recorded through the walk's own recorder, rrSetWalkRecordAdded — part F
    // proves saveWizardItem itself records what it adds)
    function addedPiece(key, row) {
      const before = Object.keys(state.personalData);
      state.personalData[key] = pd('2625', key, row, { groupId: GID });
      rrSetWalkRecordAdded(wizard.data, before, { gid: GID });
      (wizard.data._setItemsSaved = wizard.data._setItemsSaved || []).push('2625');
    }
    const engineAsWas = () => !!state.personalData.kE && state.personalData.kE.groupId === 'GRP-E' && !!state.personalData.kEb && state.personalData.kEb.groupId === 'GRP-E' && state.isData.i1.groupId === 'GRP-E';

    if (part === 'A') {
    // W1 / W2 — the pick
    seed();
    R.w1Asked = await startAndUseEngine();
    R.w1Writes = W.updates.length;
    R.w1Engine = engineAsWas();
    R.w1Used = (wizard.data._setUsedOwned || []).join(',');
    R.w1Idx = wizard.data._setItemIndex;
    R.w1Toast = W.toasts.slice(-1)[0] || '';
    const ask2 = document.getElementById('rr-set-owned-ask');
    const useP = ask2 && ask2.querySelector('button[data-use="kP"]');
    R.w2Asked = !!useP;
    if (useP) useP.click();
    await sleep(150);
    R.w2Tab = wizard.tab; R.w2Num = wizard.data.itemNum;
    R.w2Used = (wizard.data._setUsedOwned || []).join(',');
    R.w2Writes = W.updates.length;
    R.w2Toast = W.toasts.join(' | ');

    // W3 — Cancel mid-walk after one piece was added — by the REAL saveWizardItem
    const before3 = Object.keys(state.personalData);
    try { await saveWizardItem(); } catch (e) { R.w3SaveErr = String(e && e.message || e); }
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 2; i++) await sleep(25);
    await sleep(80);
    const new3 = Object.keys(state.personalData).filter(k => before3.indexOf(k) < 0);
    R.w3NewRows = new3.map(k => String(state.personalData[k].row)).join(',');
    R.w3Recorded = (wizard.data._setAddedKeys || []).map(r => r.num + '@' + r.gid).join(',');
    try { closeWizard(); } catch (e) { R.w3Err = e.message; }
    await sleep(60);
    const cBtn = document.getElementById('set-cancel-confirm');
    R.w3Asked = !!cBtn;
    R.w3Text = cBtn ? (cBtn.closest('.rr-card') || document.body).textContent.replace(/\s+/g, ' ') : '';
    R.w3Kept = (document.getElementById('set-cancel-kept') || {}).textContent || '';
    if (cBtn) cBtn.click();
    for (let i = 0; i < 40 && !W.deletes.length; i++) await sleep(25);
    await sleep(80);
    R.w3Deleted = W.deletes.map(d => d.row).join(',');
    R.w3Engine = engineAsWas();
    R.w3EngineNotDeleted = !!state.personalData.kE && !!state.personalData.kEb && !/(^|,)(5|6)(,|$)/.test(R.w3Deleted);
    R.w3Writes = W.updates.length;
    R.w3N1Gone = new3.length > 0 && new3.every(k => !state.personalData[k]);
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'B') {
    // W4 — Discard with only the engine picked
    seed();
    window.appConfirm = async () => true;
    await startAndUseEngine();
    const ask4 = document.getElementById('rr-set-owned-ask'); if (ask4) { const a = ask4.querySelector('button[data-add]'); if (a) a.click(); }
    await sleep(80);
    try { closeWizard(); } catch (e) { R.w4Err = e.message; }
    await sleep(120);
    R.w4SetCancel = !!document.getElementById('set-cancel-confirm');
    R.w4Closed = !document.getElementById('wizard-modal').classList.contains('open');
    R.w4Deleted = W.deletes.length; R.w4Writes = W.updates.length;
    R.w4Engine = engineAsWas();
    R.w4Abandoned = _rrAbandonedSetGroups().map(g => g.groupId).join(',');
    { const o = document.getElementById('set-cancel-confirm'); const card = o && o.closest('.rr-card'); if (card && card.parentElement) card.parentElement.remove(); }
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'C') {
    // W5 / W6 / W7 — Save (pressed twice), then a second link call
    seed();
    await startAndUseEngine();
    const ask5 = document.getElementById('rr-set-owned-ask'); if (ask5) { const a = ask5.querySelector('button[data-add]'); if (a) a.click(); }
    await sleep(60);
    addedPiece('kN1', 30); addedPiece('kN2', 31); addedPiece('kN3', 32);
    wizard.data._setItemIndex = 4;
    launchSetItemWizard();                       // all pieces done → back to the set's own steps
    await sleep(60);
    R.w5Step = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    const s1 = saveSet(), s2 = saveSet();
    await Promise.all([s1, s2]);
    await sleep(80);
    const msA = W.appends.filter(a => /My Sets/.test(a.range));
    R.w6MySets = msA.length;
    R.w5Rows = W.updates.map(u => u.tab + ':' + u.row + '=' + u.v).join('|');
    R.w5Order = msA.length && W.updates.length ? msA[0].seq < Math.min.apply(null, W.updates.map(u => u.seq)) : false;
    R.w5Engine = state.personalData.kE.groupId === GID && state.personalData.kEb.groupId === GID && state.isData.i1.groupId === GID;
    R.w5Toast = W.toasts.slice(-1)[0] || '';
    W.updates.length = 0;
    const again = await rrSetLinkUsedOwned(wizard.data, GID, 'Set 2124W');
    R.w7 = again.linked.length + '|' + again.refused.length + '|' + W.updates.length;
    // two link calls at once on a fresh walk record
    seed();
    const fresh = { _setUsedOwned: ['kE'] };
    const [x1, x2] = await Promise.all([rrSetLinkUsedOwned(fresh, GID, 'Set 2124W'), rrSetLinkUsedOwned(fresh, GID, 'Set 2124W')]);
    R.w7b = [x1.linked.length, x1.refused.length, x2.linked.length, x2.refused.length].join(',') + '|' + W.updates.filter(u => u.row === 5).length;
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'D') {
    // W8 — the set's row fails: the engine is not linked
    seed();
    await startAndUseEngine();
    const ask8 = document.getElementById('rr-set-owned-ask'); if (ask8) { const a = ask8.querySelector('button[data-add]'); if (a) a.click(); }
    await sleep(60);
    addedPiece('kN1', 30);
    wizard.data._setItemIndex = 4; launchSetItemWizard(); await sleep(60);
    W.appendFail = true;
    await saveSet(); await sleep(80);
    R.w8Writes = W.updates.length; R.w8Engine = engineAsWas();
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'E') {
    // W9 — the copy went into another set meanwhile
    seed();
    await startAndUseEngine();
    const ask9 = document.getElementById('rr-set-owned-ask'); if (ask9) { const a = ask9.querySelector('button[data-add]'); if (a) a.click(); }
    await sleep(60);
    addedPiece('kN1', 30);
    wizard.data._setItemIndex = 4; launchSetItemWizard(); await sleep(60);
    state.personalData.kE.groupId = 'SET-1464W-1';
    await saveSet(); await sleep(80);
    R.w9Writes = W.updates.filter(u => u.row === 5 || u.row === 6).length;
    R.w9MySets = W.appends.filter(a => /My Sets/.test(a.range)).length;
    R.w9Toast = W.toasts.slice(-1)[0] || '';
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'F') {
    // W10 / W11 — a set started from an item page's "Add Another Item": the walk
    // runs under THAT item's group. The piece is saved by the REAL saveWizardItem.
    seed();
    state.personalData.kO  = pd('6464', '120', 8, { groupId: 'GRP-O', condition: '7' });   // the item the walk started from
    state.personalData.kOb = pd('6464-BOX', '121', 9, { groupId: 'GRP-O' });               // its box
    delete state.personalData.kP;
    _buildWizardModal();
    document.getElementById('wizard-modal').classList.add('open');
    wizard = { step: 0, tab: 'set', steps: getSteps('set'), matchedItem: null, data: Object.assign(setData(), {
      _setFinalItems: ['6457'], _setGroupId: 'GRP-O', _addToGroupGid: 'GRP-O', _addToGroupInv: '120', _setAddedKeys: [] }) };
    launchSetItemWizard();
    await sleep(80);
    R.w10Tab = wizard.tab; R.w10Num = wizard.data.itemNum; R.w10Gid = wizard.data._setGroupId;
    const keysBefore = Object.keys(state.personalData).sort().join(',');
    try { await saveWizardItem(); } catch (e) { R.w10SaveErr = String(e && e.message || e); }
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 1; i++) await sleep(25);
    await sleep(80);
    const newKeys = Object.keys(state.personalData).filter(k => keysBefore.split(',').indexOf(k) < 0);
    R.w10New = newKeys.map(k => state.personalData[k].itemNum + '@' + state.personalData[k].groupId).join(',');
    R.w10Added = (wizard.data._setAddedKeys || []).map(r => r.num).join(',');
    R.w10AddedIsNew = (wizard.data._setAddedKeys || []).length > 0 && (wizard.data._setAddedKeys || []).every(r => newKeys.indexOf(r.key) >= 0);
    try { closeWizard(); } catch (e) { R.w10Err = e.message; }
    await sleep(80);
    const c10 = document.getElementById('set-cancel-confirm');
    R.w10Asked = !!c10;
    R.w10Text = c10 ? (c10.closest('.rr-card') || document.body).textContent.replace(/\s+/g, ' ') : '';
    R.w10List = (document.getElementById('set-cancel-list') || {}).textContent || '';
    W.deletes.length = 0;
    if (c10) { const a = c10.onclick(), b = c10.onclick(); await Promise.all([a, b]); }   // pressed twice
    await sleep(120);
    R.w10Deleted = W.deletes.map(x => x.row).join(',');
    R.w10Orig = !!state.personalData.kO && state.personalData.kO.groupId === 'GRP-O' && !!state.personalData.kOb && state.personalData.kOb.groupId === 'GRP-O';
    R.w10NewGone = newKeys.every(k => !state.personalData[k]);
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'G') {
    // W12 / W13 — review finding 1: another device's rows arrive DURING the save
    // (a refresh), and the outbox later re-mints the piece's id because another
    // real item already wears it. Real saveWizardItem.
    seed(); delete state.personalData.kP;
    _buildWizardModal();
    document.getElementById('wizard-modal').classList.add('open');
    wizard = { step: 0, tab: 'set', steps: getSteps('set'), matchedItem: null, data: Object.assign(setData(), { _setFinalItems: ['6457'], _setAddedKeys: [] }) };
    launchSetItemWizard();
    await sleep(80);
    const realAppend = window.sheetsAppend;
    window.sheetsAppend = async (id, range, rows) => {
      // a foreground refresh lands mid-save: two rows from another device
      state.personalData.kF  = pd('6464', '150', 40, { groupId: 'GRP-F' });
      state.personalData.kF2 = pd('2625', '151', 41, { groupId: 'SET-OTHER-1' });
      return realAppend(id, range, rows);
    };
    try { await saveWizardItem(); } catch (e) { R.w12Err = String(e && e.message || e); }
    window.sheetsAppend = realAppend;
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 1; i++) await sleep(25);
    await sleep(80);
    const rec = (wizard.data._setAddedKeys || []).slice();
    R.w12Rec = rec.map(r => r.num + '@' + r.gid).join(',');
    const X = rec[0] && rec[0].key;
    // the outbox's re-read: id X turns out to be another real item's; the piece is re-minted as Y
    const Y = '777';
    if (X) {
      const piece = state.personalData[X];
      state.personalData[X] = pd('6017', String(X), 50, { groupId: '' });
      state.personalData[Y] = Object.assign({}, piece, { inventoryId: Y, row: 51 });
    }
    R.w13Before = rrSetWalkAddedNow(wizard.data).join(',');          // before the walk hears of it: nothing matches
    document.dispatchEvent(new CustomEvent('rr-remint', { detail: { from: String(X), to: Y, num: '6457' } }));
    R.w13After = rrSetWalkAddedNow(wizard.data).join(',');
    W.deletes.length = 0;
    try { closeWizard(); } catch (e) { R.w13Err = e.message; }
    await sleep(80);
    const c13 = document.getElementById('set-cancel-confirm');
    if (c13) c13.click();
    for (let i = 0; i < 40 && !W.deletes.length; i++) await sleep(25);
    await sleep(80);
    R.w13Deleted = W.deletes.map(x => x.row).join(',');
    R.w13Others = !!state.personalData.kF && !!state.personalData.kF2 && !!state.personalData[X] && state.personalData[X].itemNum === '6017';
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'H') {
    // W14 — review finding 2: a quick-entry walk save that fails half-way (the
    // tender's row throws after the lead's row is stored). Real quickEntryAdd.
    seed(); delete state.personalData.kP;
    _buildWizardModal();
    document.getElementById('wizard-modal').classList.add('open');
    wizard = { step: 0, tab: 'set', steps: getSteps('set'), matchedItem: null, data: Object.assign(setData(), { _setFinalItems: ['6457'], _setAddedKeys: [] }) };
    launchSetItemWizard();
    await sleep(80);
    Object.assign(wizard.data, { _qeMultiResolved: true, _qeTender: '6466W', _qeCondition: '7', entryMode: 'quick' });
    let n14 = 0;
    const realAppend = window.sheetsAppend;
    window.sheetsAppend = async (id, range, rows) => { if (++n14 === 2) throw new Error('network (test)'); return realAppend(id, range, rows); };
    const before14 = Object.keys(state.personalData);
    try { await quickEntryAdd(); } catch (e) { R.w14Err = String(e && e.message || e); }
    window.sheetsAppend = realAppend;
    await sleep(80);
    const new14 = Object.keys(state.personalData).filter(k => before14.indexOf(k) < 0);
    R.w14New = new14.map(k => state.personalData[k].itemNum + '@' + state.personalData[k].row).join(',');
    R.w14Rec = (wizard.data._setAddedKeys || []).map(r => r.num).join(',');
    W.deletes.length = 0;
    try { closeWizard(); } catch (e) { R.w14CloseErr = e.message; }
    await sleep(80);
    const c14 = document.getElementById('set-cancel-confirm');
    R.w14Asked = !!c14;
    if (c14) c14.click();
    for (let i = 0; i < 40 && !W.deletes.length; i++) await sleep(25);
    await sleep(60);
    R.w14Deleted = W.deletes.map(x => x.row).join(',');
    R.w14NewRows = new14.map(k => '').length ? Object.keys(state.personalData).filter(k => new14.indexOf(k) >= 0).length : -1;
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'I') {
    // W15 — review finding 6: an "Add Another Item" set walk whose only piece is
    // "use the one I have" links it to THAT item's group, not to a SET- group.
    seed(); delete state.personalData.kP;
    state.personalData.kO = pd('6464', '120', 8, { groupId: 'GRP-O' });
    _buildWizardModal();
    document.getElementById('wizard-modal').classList.add('open');
    wizard = { step: 0, tab: 'set', steps: getSteps('set'), matchedItem: null, data: Object.assign(setData(), {
      _setFinalItems: ['2332'], _addToGroupGid: 'GRP-O', _addToGroupInv: '120', _setAddedKeys: [] }) };
    launchSetItemWizard();
    await sleep(60);
    const a15 = document.getElementById('rr-set-owned-ask');
    const u15 = a15 && a15.querySelector('button[data-use="kE"]');
    if (u15) u15.click();
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 1; i++) await sleep(25);
    await sleep(120);
    R.w15Step = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    await saveSet(); await sleep(100);
    const ms15 = W.appends.find(a => /My Sets/.test(a.range));
    R.w15SetGid = ms15 ? String(ms15.row[6]) : '';
    R.w15Rows = W.updates.map(u => u.tab + ':' + u.row + '=' + u.v).join('|');
    R.w15Engine = state.personalData.kE.groupId;
    try { _doCloseWizard(); } catch (e) {}
    }

    // helper for J–M: a one-piece walk (6457) on the Add steps
    async function onePieceWalk(extra) {
      seed(); delete state.personalData.kP;
      _buildWizardModal();
      document.getElementById('wizard-modal').classList.add('open');
      wizard = { step: 0, tab: 'set', steps: getSteps('set'), matchedItem: null, data: Object.assign(setData(), { _setFinalItems: ['6457', '2625'], _setAddedKeys: [], _setAdopted: [] }, extra || {}) };
      launchSetItemWizard();
      await sleep(80);
    }
    async function cancelWalk() {
      W.deletes.length = 0;
      try { closeWizard(); } catch (e) {}
      await sleep(80);
      const c = document.getElementById('set-cancel-confirm');
      const asked = !!c;
      if (c) c.click();
      for (let i = 0; i < 40 && document.getElementById('set-cancel-confirm'); i++) await sleep(25);
      await sleep(120);
      return asked;
    }

    if (part === 'J') {
    // W16 — review 2 finding 5: a save inside the walk that throws AFTER its box row
    // was stored (and before the set branch) — the record in saveWizardItem's finally
    // still takes the box. Real saveWizardItem; the fault is a getter that throws.
    await onePieceWalk();
    wizard.data.hasBox = 'Yes'; wizard.data.boxCond = '7';
    Object.defineProperty(wizard.data, '_rrAddUploads', { configurable: true, get() { throw new Error('planted fault (test)'); } });
    const b16 = Object.keys(state.personalData);
    try { await saveWizardItem(); } catch (e) { R.w16Err = String(e && e.message || e); }
    await sleep(80);
    R.w16New = Object.keys(state.personalData).filter(k => b16.indexOf(k) < 0).map(k => state.personalData[k].itemNum).sort().join(',');
    R.w16Rec = (wizard.data._setAddedKeys || []).map(r => r.num).sort().join(',');
    delete wizard.data._rrAddUploads;
    const boxKey = Object.keys(state.personalData).find(k => b16.indexOf(k) < 0 && /-BOX$/.test(state.personalData[k].itemNum));
    const boxRow = boxKey ? String(state.personalData[boxKey].row) : '';
    R.w16Asked = await cancelWalk();
    R.w16Deleted = W.deletes.map(x => String(x.row)).join(',');
    R.w16BoxRow = boxRow;
    R.w16BoxGone = !!boxKey && !state.personalData[boxKey];
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'K') {
    // W17 — review 2 finding 1: a piece saved OFFLINE (its append waits in the outbox,
    // its row is 0). Cancel takes the queued append back; if it cannot (it already
    // went, or a send is in flight), the piece is KEPT and the message says so.
    const realAppend = window.sheetsAppend;
    window.sheetsAppend = async (id, range, rows) => { rrOutboxRecord('append', { sheetId: id, range: range, values: rows }, new Error('offline')); return 0; };
    try { rrOutboxClear(); } catch (e) {}
    await onePieceWalk();
    try { await saveWizardItem(); } catch (e) { R.w17Err = String(e && e.message || e); }
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 1; i++) await sleep(25);
    await sleep(60);
    const inv17 = ((wizard.data._setAddedKeys || [])[0] || {}).inv || '';
    const ivx = PERSONAL_FIELD_INDEX.inventoryId;
    const queued = () => rrOutboxList().filter(e => e.kind === 'append' && String(e.args.values[0][ivx]) === inv17).length;
    R.w17QueuedBefore = queued();
    R.w17Asked = await cancelWalk();
    R.w17QueuedAfter = queued();
    R.w17Gone = !!inv17 && !Object.keys(state.personalData).some(k => String(state.personalData[k].inventoryId) === inv17);
    R.w17Deleted = W.deletes.length;
    try { _doCloseWizard(); } catch (e) {}
    // b) the queued add already went (nothing to take back): kept, and said
    W.toasts.length = 0;
    try { rrOutboxClear(); } catch (e) {}
    await onePieceWalk();
    try { await saveWizardItem(); } catch (e) {}
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 1; i++) await sleep(25);
    await sleep(60);
    const inv17b = ((wizard.data._setAddedKeys || [])[0] || {}).inv || '';
    try { rrOutboxClear(); } catch (e) {}
    await cancelWalk();
    R.w17bKept = !!inv17b && Object.keys(state.personalData).some(k => String(state.personalData[k].inventoryId) === inv17b);
    R.w17bToast = W.toasts.filter(t => /Set entry canceled/.test(t)).slice(-1)[0] || '';
    window.sheetsAppend = realAppend;
    try { rrOutboxClear(); } catch (e) {}
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'L') {
    // W18 — review 2 finding 3: a box you already had, adopted into the walk's group on
    // a piece's Confirm step, goes back to no group when the walk is cancelled.
    await onePieceWalk();
    state.personalData.kBx = pd('6457-BOX', '160', 20, { groupId: '' });
    const realFind = window.findGroupingCandidates;
    window.findGroupingCandidates = () => [{ type: 'box', invKey: 'kBx', pd: state.personalData.kBx, itemNum: '6457-BOX', flagKey: '_groupWithExistingBox' }];
    wizard.data._groupingLinkChoices = { kBx: true };
    try { await saveWizardItem(); } catch (e) { R.w18Err = String(e && e.message || e); }
    window.findGroupingCandidates = realFind;
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 1; i++) await sleep(25);
    await sleep(80);
    R.w18Adopted = state.personalData.kBx.groupId;
    W.updates.length = 0;
    R.w18Asked = await cancelWalk();
    R.w18After = state.personalData.kBx ? state.personalData.kBx.groupId : 'GONE';
    R.w18Writes = W.updates.map(u => u.row + '=' + u.v).join('|');
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'N') {
    // W20 — review 3 gap 3: an offline piece whose queued add was RE-MINTED (its id
    // belonged to another item) and whose send then failed: memory still has the
    // OLD id, the record and the queued add the fresh one. Cancel still finds the
    // piece and takes the queued add back.
    const realAppend = window.sheetsAppend;
    window.sheetsAppend = async (id, range, rows) => { rrOutboxRecord('append', { sheetId: id, range: range, values: rows }, new Error('offline')); return 0; };
    try { rrOutboxClear(); } catch (e) {}
    await onePieceWalk();
    try { await saveWizardItem(); } catch (e) { R.w20Err = String(e && e.message || e); }
    for (let i = 0; i < 40 && (wizard.data._setItemIndex || 0) < 1; i++) await sleep(25);
    await sleep(60);
    const X = ((wizard.data._setAddedKeys || [])[0] || {}).inv || '';
    const Y = '888';
    const ivx = PERSONAL_FIELD_INDEX.inventoryId;
    // the drain's re-mint: the queued row now carries Y (saved back after its send failed)
    const q = rrOutboxList(); q.forEach(e => { if (e.kind === 'append' && String(e.args.values[0][ivx]) === X) e.args.values[0][ivx] = Y; });
    localStorage.setItem('rr_write_outbox', JSON.stringify(q));
    document.dispatchEvent(new CustomEvent('rr-remint', { detail: { from: X, to: Y, num: '6457' } }));
    R.w20MemOld = Object.keys(state.personalData).some(k => String(state.personalData[k].inventoryId) === X);
    R.w20QueuedY = rrOutboxList().filter(e => e.kind === 'append' && String(e.args.values[0][ivx]) === Y).length;
    R.w20Asked = await cancelWalk();
    R.w20QueuedAfter = rrOutboxList().filter(e => e.kind === 'append' && String(e.args.values[0][ivx]) === Y).length;
    R.w20Gone = !Object.keys(state.personalData).some(k => String(state.personalData[k].inventoryId) === X);
    window.sheetsAppend = realAppend;
    try { rrOutboxClear(); } catch (e) {}
    try { _doCloseWizard(); } catch (e) {}
    }

    if (part === 'M') {
    // W19 — review 2 finding 4: a record whose key is a temp_ key follows a re-mint
    // (its key and id), and a re-keyed row is found again by its id.
    seed();
    const G = 'SET-2124W-NEW';
    state.personalData.temp_x = pd('6457', '500', 30, { groupId: G });
    const d19 = { _setAddedKeys: [{ key: 'temp_x', inv: '500', num: '6457', gid: G }] };
    wizard = { step: 0, tab: 'set', steps: [], matchedItem: null, data: d19 };
    document.dispatchEvent(new CustomEvent('rr-remint', { detail: { from: '500', to: '600', num: '6457' } }));
    R.w19Key = d19._setAddedKeys[0].key + '/' + d19._setAddedKeys[0].inv;
    // the sheet is read back: the row is now keyed by its new id
    delete state.personalData.temp_x;
    state.personalData['600'] = pd('6457', '600', 30, { groupId: G });
    R.w19Now = rrSetWalkAddedNow(d19).join(',');
    // a stale key (re-keyed by a reload, no re-mint) is found again by its id
    const d19b = { _setAddedKeys: [{ key: 'temp_y', inv: '600', num: '6457', gid: G }] };
    R.w19Stale = rrSetWalkAddedNow(d19b).join(',');
    }
    return R;
  }, part);
}
// Each part on a fresh page, so one part's aftermath cannot spoil the next
// (on the OLD code, the cancel that deletes the engine takes the page away).
// R.errs = page errors; R.unfinished = parts that did not come back.
async function walkAll(browser, planted) {
  const R = { errs: [], unfinished: [] };
  for (const part of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']) {
    const o = await open(browser, DESK, planted);
    try { Object.assign(R, await walkScenario(o.pg, part)); }
    catch (e) { R.unfinished.push(part + ': ' + String(e && e.message || e).slice(0, 80)); }
    R.errs = R.errs.concat(o.errs);
    await o.pg.close().catch(() => {});
  }
  return R;
}
const PART_OF = { W1: 'A', W2: 'A', W3: 'A', W4: 'B', W5: 'C', W6: 'C', W7: 'C', W8: 'D', W9: 'E', W10: 'F', W11: 'F', W12: 'G', W13: 'G', W14: 'H', W15: 'I', W16: 'J', W17: 'K', W18: 'L', W19: 'M', W20: 'N' };

// ── ITEM 3: removing a set ──────────────────────────────────────────────────
const SEED_SETS = () => {
  const pd = (n, inv, row, gid) => ({ owned: true, itemNum: n, variation: '', inventoryId: inv, row: row, era: 'pw', manufacturer: 'Lionel', groupId: gid });
  state.personalData = {
    p1: pd('2332', '110', 10, 'SET-2124W-9'),
    p2: pd('2625', '111', 11, 'SET-2124W-9'),
    p3: pd('6457', '112', 12, 'OWN-X'),
    p4: pd('6457', '113', 13, 'SET-9999W-1'),   // a walk that really never finished (no My Sets row)
  };
  state.isData = { i9: { sheetNum: '2332-IS', linkedItem: '2332', groupId: 'SET-2124W-9', row: 7, inventoryId: 'I9', owned: true } };
  state.mySetsData = {
    M1: { row: 40, setNum: '2124W', setName: 'Passenger Set', year: '1947', groupId: 'SET-2124W-9', setId: 'SET-2124W', inventoryId: 'M1' },
    M2: { row: 41, setNum: '', setName: 'Club Special', year: '', groupId: 'OWN-X', setId: 'OWN-SET', inventoryId: 'M2', manufacturer: 'MTH' },
    M3: { row: 42, setNum: '1464W', setName: 'Lonely Set', year: '1949', groupId: '', setId: 'SET-1464W', inventoryId: 'M3' },
  };
  const W = window.__w; W.updates.length = 0; W.removes.length = 0; W.toasts.length = 0; W.removeOk = true;
  window.__bu = [];
  if (!window.__buWrapped) {
    window.__buWrapped = true;
    const orig = window._breakUpGroup;
    window._breakUpGroup = async function (k) { window.__bu.push(k); return orig.apply(this, arguments); };
  }
};
const DIALOG = () => {
  const yes = document.getElementById('_ac-yes');
  const box = yes ? yes.closest('div[style*="max-width:420px"]') : null;
  const radios = box ? [...box.querySelectorAll('input[type="radio"]')] : [];
  return {
    open: !!yes,
    text: box ? box.textContent.replace(/\s+/g, ' ').trim() : '',
    radios: radios.map(r => r.value + (r.checked ? '*' : '')),
    labels: radios.map(r => (r.closest('label') || {}).textContent.replace(/\s+/g, ' ').trim()),
  };
};
const STATE = () => ({
  active: (document.querySelector('.page.active') || {}).id || '',
  tab: state._browseTab, owned: !!state.filters.owned,
  myHead: (() => { const h = document.getElementById('rr-mysets-head'); return !!h && h.getClientRects().length > 0; })(),
  sets: Object.keys(state.mySetsData || {}).sort().join(','),
  gids: Object.keys(state.personalData).sort().map(k => k + '=' + state.personalData[k].groupId).join(','),
  isGid: state.isData.i9 ? state.isData.i9.groupId : '?',
  pieces: Object.keys(state.personalData).length,
  writes: window.__w.updates.map(u => u.tab + ':' + u.row + '=' + u.v).join('|'),
  removes: window.__w.removes.map(r => r.tab + ':' + r.row).join('|'),
  toast: window.__w.toasts.slice(-1)[0] || '',
  bu: (window.__bu || []).join(','),
  kept: (typeof rrSetKeptGroups === 'function') ? rrSetKeptGroups().join(',') : '',
  abandoned: _rrAbandonedSetGroups().map(g => g.groupId).sort().join(','),
});

async function removeWalk(browser, viewport, planted) {
  const { pg, errs } = await open(browser, viewport, planted);
  const R = {};
  await pg.evaluate(SEED_SETS);
  const phone = viewport.width < 600;
  // R1–R3: My Collection → My Sets → the catalog set's page → Remove → Keep
  if (phone) await pg.click('#mnav-collection'); else await pg.click('.nav-item[onclick*="filterOwned"]');
  await sleep(pg, 250);
  const door = await pg.$('#rr-mysets-door');
  if (door && await door.isVisible()) { await door.click(); await sleep(pg, 250); }
  const rowSel = phone ? '#browse-sets-cards [data-my-set-card="M1"]' : '#browse-sets-tbody tr[onclick*="M1"]';
  const row = await pg.$(rowSel);
  if (row && await row.isVisible()) { await row.click(); await sleep(pg, 350); }
  R.onPage = await pg.evaluate(STATE);
  const rm = await pg.$('#detail-remove-item');
  if (rm && await rm.isVisible()) { await rm.click(); await sleep(pg, 200); }
  R.dlg = await pg.evaluate(DIALOG);
  const yes = await pg.$('#_ac-yes'); if (yes) { await yes.click(); await sleep(pg, 400); }
  R.afterKeep = await pg.evaluate(STATE);
  R.errs = errs;
  if (phone) { await pg.close(); return R; }

  // R4: own set opened from My Collection (not My Sets) → Break up
  await pg.evaluate(() => { window.__w.updates.length = 0; window.__w.toasts.length = 0; delete window._lastBrowseState; state._browseTab = 'items'; filterOwned(); });
  await sleep(pg, 200);
  await pg.evaluate(() => showNonItemDetailPage('sets', 'M2')); await sleep(pg, 250);
  R.onPage2 = await pg.evaluate(STATE);
  await pg.click('#detail-remove-item'); await sleep(pg, 200);
  R.dlg2 = await pg.evaluate(DIALOG);
  const br = await pg.$('input[type="radio"][value="break"]'); if (br) { await br.click(); await sleep(pg, 80); }
  const yes2 = await pg.$('#_ac-yes'); if (yes2) { await yes2.click(); await sleep(pg, 500); }
  R.afterBreak = await pg.evaluate(STATE);

  // R5 / R8: the set with no pieces, removed from the LIST while its page is open
  await pg.evaluate(() => showNonItemDetailPage('sets', 'M3')); await sleep(pg, 250);
  const p3 = pg.evaluate(() => _removeOwnedSet('M3')); await sleep(pg, 200);
  R.dlg3 = await pg.evaluate(DIALOG);
  const yes3 = await pg.$('#_ac-yes'); if (yes3) { await yes3.click(); }
  await p3; await sleep(pg, 200);
  R.afterAlone = await pg.evaluate(STATE);

  // R6: Cancel changes nothing; R7: the sheet refuses
  await pg.evaluate(SEED_SETS);
  await pg.evaluate(() => showNonItemDetailPage('sets', 'M1')); await sleep(pg, 250);
  await pg.click('#detail-remove-item'); await sleep(pg, 200);
  const no = await pg.$('#_ac-no'); if (no) { await no.click(); await sleep(pg, 250); }
  R.afterCancel = await pg.evaluate(STATE);
  await pg.evaluate(() => { window.__w.removeOk = false; });
  await pg.click('#detail-remove-item'); await sleep(pg, 200);
  const br7 = await pg.$('input[type="radio"][value="break"]'); if (br7) { await br7.click(); await sleep(pg, 80); }
  const yes7 = await pg.$('#_ac-yes'); if (yes7) { await yes7.click(); await sleep(pg, 400); }
  R.afterRefused = await pg.evaluate(STATE);
  R.errs = errs;
  await pg.close();
  return R;
}

// Review findings 3, 4, 5 — the kept setting, the leftover notice, a shared group.
async function removeWalk2(browser, planted) {
  const { pg, errs } = await open(browser, DESK, planted);
  const R = {};
  await pg.evaluate(SEED_SETS);
  // R9 — the sheet refuses: the keep is taken back; then it accepts: "keep" is
  // written BEFORE the set leaves memory (no draw in between calls it unfinished)
  await pg.evaluate(() => {
    window.__w.removeOk = false;
    window.__w.during = [];
    const real = window.rrRemoveRowConfirmed;
    window.rrRemoveRowConfirmed = async function () { window.__w.during.push(_rrAbandonedSetGroups().map(g => g.groupId).sort().join(',')); return real.apply(this, arguments); };
  });
  let pr = pg.evaluate(() => _removeOwnedSet('M1')); await sleep(pg, 200);
  let y = await pg.$('#_ac-yes'); if (y) await y.click(); await pr; await sleep(pg, 150);
  R.refusedKept = await pg.evaluate(() => rrSetKeptGroups().join(','));
  R.refusedSets = await pg.evaluate(() => Object.keys(state.mySetsData).sort().join(','));
  await pg.evaluate(() => { window.__w.removeOk = true; window.__w.during = []; });
  pr = pg.evaluate(() => _removeOwnedSet('M1')); await sleep(pg, 200);
  y = await pg.$('#_ac-yes'); if (y) await y.click(); await pr; await sleep(pg, 150);
  R.during = await pg.evaluate(() => window.__w.during.join('|'));
  R.keptAfter = await pg.evaluate(() => rrSetKeptGroups().join(','));
  // R13 — the kept group broken up: no longer kept
  await pg.evaluate(async () => { await _breakUpGroup('p1'); });
  R.keptAfterBreak = await pg.evaluate(() => rrSetKeptGroups().join(','));
  // R14 — review 2 finding 2: another collection's kept group (no pieces in THIS
  // collection) survives a break-up here
  await pg.evaluate(() => { const m = JSON.parse(localStorage.getItem(RR_SET_REMOVE.keptKey) || '{}'); m['SET-OTHERCOLL-1'] = { k: Date.now(), r: 0 }; rrPrefWrite(RR_SET_REMOVE.keptKey, JSON.stringify(m)); });
  await pg.evaluate(async () => { await _breakUpGroup('p3'); });
  R.otherKept = await pg.evaluate(() => rrSetKeptGroups().join(','));
  // R11 — the setting combines across devices
  R.union = await pg.evaluate(() => ({
    always: typeof (window.RR_PREF_ALWAYS_UNION || {})[RR_SET_REMOVE.keptKey] === 'function',
    merged: window.rrSetKeptUnion('{"A":{"k":5,"r":0}}', '{"B":{"k":3,"r":0},"A":{"k":1,"r":9}}'),
  }));
  // R10 — the "Unfinished set entry" notice unlinks, never deletes
  await pg.evaluate(() => { window.__w.deletes.length = 0; window.__w.updates.length = 0; });
  await pg.click('.nav-item[onclick*="filterOwned"]');
  await sleep(pg, 400);
  R.noticeBtn = await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /_rrDropAbandonedSet/.test(x.getAttribute('onclick') || '')); return b ? b.textContent.trim() : ''; });
  pr = pg.evaluate(() => _rrDropAbandonedSet('SET-9999W-1')); await sleep(pg, 200);
  R.leftDlg = await pg.evaluate(DIALOG);
  y = await pg.$('#_ac-yes'); if (y) await y.click(); await pr; await sleep(pg, 200);
  R.leftAfter = await pg.evaluate(() => ({ p4: state.personalData.p4 ? state.personalData.p4.groupId : 'GONE', deletes: window.__w.deletes.length,
    writes: window.__w.updates.map(u => u.row + '=' + u.v).join('|'), toast: window.__w.toasts.slice(-1)[0] || '' }));
  // R12 — a set made through "Add Another Item" shares the item's group: said plainly
  await pg.evaluate(() => {
    state.personalData.kO  = { owned: true, itemNum: '6464', variation: '', inventoryId: '120', row: 8, groupId: 'GRP-O' };
    state.personalData.kOb = { owned: true, itemNum: '6464-BOX', variation: '', inventoryId: '121', row: 9, groupId: 'GRP-O' };
    state.personalData.kOn = { owned: true, itemNum: '6457', variation: '', inventoryId: '122', row: 14, groupId: 'GRP-O' };
    state.mySetsData.M4 = { row: 44, setNum: '', setName: 'Add-on Set', year: '', groupId: 'GRP-O', setId: 'OWN-SET', inventoryId: 'M4' };
  });
  pr = pg.evaluate(() => _removeOwnedSet('M4')); await sleep(pg, 200);
  R.sharedDlg = await pg.evaluate(DIALOG);
  const no = await pg.$('#_ac-no'); if (no) await no.click(); await pr;
  R.errs = errs;
  await pg.close();
  return R;
}
function remove2Checks(r) {
  const c = {};
  c.R9 = r.refusedKept === '' && r.refusedSets === 'M1,M2,M3' && r.during === 'SET-9999W-1' && r.keptAfter === 'SET-2124W-9';
  c.R13 = r.keptAfterBreak === '';
  c.R14 = r.otherKept === 'SET-OTHERCOLL-1';
  c.R11 = !!r.union && r.union.always && r.union.merged === '{"A":{"k":5,"r":9},"B":{"k":3,"r":0}}';
  c.R10 = r.noticeBtn === 'Unlink them' && !!r.leftDlg && /Unlink these 1 items/.test(r.leftDlg.text) && /stay in your collection/.test(r.leftDlg.text)
    && r.leftAfter.p4 === '' && r.leftAfter.deletes === 0 && r.leftAfter.writes === '13=' && /stay in your collection/.test(r.leftAfter.toast);
  c.R12 = !!r.sharedDlg && /shares its group with items that were grouped before it — 3 pieces in all/.test(r.sharedDlg.text) && /including the items that were grouped before this set/.test(r.sharedDlg.text);
  return c;
}

function walkChecks(r, pfx) {
  // each check on its own: a planted run reads only its own part's fields
  const c = {}; const t = (f) => { try { return !!f(); } catch (e) { return false; } };
  c.W1 = t(() => r.w1Asked && r.w1Writes === 0 && r.w1Engine && r.w1Used === 'kE' && r.w1Idx === 1 && /2332 joins Set 2124W when you finish/.test(r.w1Toast));
  c.W2 = t(() => r.w2Asked && r.w2Tab === 'collection' && r.w2Num === '2625' && r.w2Used === 'kE' && r.w2Writes === 0 && /refresh/i.test(r.w2Toast));
  c.W3 = t(() => r.w3Asked && / All 1 item /.test(r.w3Text) && /: 2625\./.test(r.w3Text) && /2332 you already had stays in your collection/.test(r.w3Kept) && r.w3Recorded === '2625@SET-2124W-NEW'
    && !!r.w3NewRows && r.w3Deleted === r.w3NewRows && r.w3Engine && r.w3EngineNotDeleted && r.w3Writes === 0 && r.w3N1Gone);
  c.W4 = t(() => !r.w4SetCancel && r.w4Closed && r.w4Deleted === 0 && r.w4Writes === 0 && r.w4Engine && r.w4Abandoned === '');
  c.W5 = t(() => r.w5Step === 'set_hasBox' && r.w5Rows === 'My Collection:5=SET-2124W-NEW|My Collection:6=SET-2124W-NEW|Instruction Sheets:4=SET-2124W-NEW' && r.w5Order && r.w5Engine && /complete/.test(r.w5Toast));
  c.W6 = t(() => r.w6MySets === 1);
  c.W7 = t(() => r.w7 === '0|0|0' && r.w7b === '1,0,0,0|1');
  c.W8 = t(() => r.w8Writes === 0 && r.w8Engine);
  c.W9 = t(() => r.w9Writes === 0 && r.w9MySets === 1 && /2332 did not join the set/.test(r.w9Toast));
  const del10 = String(r.w10Deleted || '').split(',').filter(Boolean);
  c.W10 = t(() => r.w10Tab === 'collection' && r.w10Gid === 'GRP-O' && r.w10New === '6457@GRP-O' && r.w10Added === '6457' && r.w10AddedIsNew
    && r.w10Asked && / All 1 item /.test(r.w10Text) && r.w10List === '6457' && del10.length >= 1 && del10.indexOf('8') < 0 && del10.indexOf('9') < 0
    && r.w10Orig && r.w10NewGone);
  c.W11 = t(() => del10.length === 1);
  c.W12 = t(() => r.w12Rec === '6457@SET-2124W-NEW');
  c.W13 = t(() => r.w13Before === '' && r.w13After === '777' && r.w13Deleted === '51' && r.w13Others);
  c.W14 = t(() => /^6457@\d+$/.test(r.w14New || '') && r.w14Rec === '6457' && r.w14Asked && !!r.w14Deleted && r.w14Deleted.split(',').length === 1 && r.w14NewRows === 0);
  c.W16 = t(() => /planted fault/.test(String(r.w16Err || '') + 'planted fault') && r.w16Rec.indexOf('6457-BOX') >= 0 && r.w16Asked && !!r.w16BoxRow && r.w16Deleted.split(',').indexOf(r.w16BoxRow) >= 0 && r.w16BoxGone);
  c.W17 = t(() => r.w17QueuedBefore === 1 && r.w17Asked && r.w17QueuedAfter === 0 && r.w17Gone && r.w17Deleted === 0
    && r.w17bKept && /could not be taken back/.test(r.w17bToast));
  c.W18 = t(() => /^SET-2124W-NEW$/.test(r.w18Adopted || '') && r.w18Asked && r.w18After === '' && r.w18Writes === '20=');
  c.W20 = t(() => r.w20MemOld && r.w20QueuedY === 1 && r.w20Asked && r.w20QueuedAfter === 0 && r.w20Gone);
  c.W19 = t(() => r.w19Key === '600/600' && r.w19Now === '600' && r.w19Stale === '600');
  c.W15 = t(() => r.w15Step === 'set_hasBox' && r.w15SetGid === 'GRP-O' && r.w15Engine === 'GRP-O' && /My Collection:5=GRP-O/.test(r.w15Rows) && !/SET-/.test(r.w15Rows));
  return c;
}
function removeChecks(r) {
  const c = {};
  const a = r.afterKeep || {};
  c.R1 = (r.onPage || {}).active === 'page-itemdetail' && a.active === 'page-browse' && a.tab === 'sets' && a.owned && a.myHead && a.sets === 'M2,M3';
  c.R2 = !!r.dlg && r.dlg.open && /Remove “Passenger Set” from your collection\?/.test(r.dlg.text) && /Its 2 pieces stay in your collection either way\./.test(r.dlg.text)
    && JSON.stringify(r.dlg.radios) === '["keep*","break"]' && /^Keep the pieces grouped/.test(r.dlg.labels[0] || '') && /^Break up the group/.test(r.dlg.labels[1] || '')
    && !/remove the pieces|delete/i.test(r.dlg.text);
  c.R3 = a.gids === 'p1=SET-2124W-9,p2=SET-2124W-9,p3=OWN-X,p4=SET-9999W-1' && a.isGid === 'SET-2124W-9' && a.writes === '' && a.removes === 'My Sets:40'
    && a.kept === 'SET-2124W-9' && a.abandoned === 'SET-9999W-1' && /still in your collection, grouped/.test(a.toast) && a.pieces === 4;
  if (r.afterBreak) {
    const b = r.afterBreak;
    c.R4 = (r.onPage2 || {}).active === 'page-itemdetail' && b.active === 'page-browse' && b.tab !== 'sets' && b.sets === 'M3'
      && /p3=(,|$)/.test(b.gids + ',') && b.bu === 'p3' && /My Collection:12=$/.test(b.writes) && b.pieces === 4 && /no longer grouped/.test(b.toast)
      && JSON.stringify((r.dlg2 || {}).radios) === '["keep*","break"]' && /Its 1 piece stays in your collection either way\./.test((r.dlg2 || {}).text);
    c.R5 = (r.dlg3 || {}).open && /Only the set’s own entry is removed/.test(r.dlg3.text) && r.dlg3.radios.length === 0 && r.afterAlone.sets === '' && /Set removed from your collection/.test(r.afterAlone.toast);
    c.R8 = r.afterAlone.active === 'page-itemdetail';
    const k = r.afterCancel;
    c.R6 = k.active === 'page-itemdetail' && k.sets === 'M1,M2,M3' && k.removes === '' && k.writes === '';
    const f = r.afterRefused;
    c.R7 = f.sets === 'M1,M2,M3' && f.gids === 'p1=SET-2124W-9,p2=SET-2124W-9,p3=OWN-X,p4=SET-9999W-1' && f.writes === '' && f.bu === '' && f.removes === 'My Sets:40';
  }
  return c;
}

// One section per suite file (each must finish inside run-all's 180 s quick
// limit): walk · walkplants_a · walkplants_b · remove · removeplants_a · removeplants_b.
async function runSection(section, suiteName) {
  const on = (s) => section === s;
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  if (on('walk')) {
  // ── Item 4 ──
  const WR = await walkAll(browser);
  const wErrs = WR.errs.filter(e => !/fonts|Failed to fetch|net::/i.test(e)).concat(WR.unfinished);
  const wc = walkChecks(WR);
  ok('W1 "Use the one I have" writes nothing — the 2332 keeps its own group; the walk moves on and says it joins when you finish', wc.W1, JSON.stringify([WR.w1Asked, WR.w1Writes, WR.w1Engine, WR.w1Used, WR.w1Idx, WR.w1Toast]));
  ok('W2 a copy the stamp would refuse (not on the sheet yet) falls through to the Add steps and is not remembered', wc.W2, JSON.stringify([WR.w2Asked, WR.w2Tab, WR.w2Num, WR.w2Used, WR.w2Writes, WR.w2Toast]));
  ok('W3 Cancel mid-walk deletes only the piece the walk added — the 2332 and its box stay; the question counts 1 and names the 2332', wc.W3, JSON.stringify([WR.w3Asked, WR.w3Text.slice(0, 160), WR.w3Kept, WR.w3Deleted, WR.w3Engine, WR.w3Writes, WR.w3Err]));
  ok('W4 Discard with only the 2332 picked: no "Delete All", nothing deleted or written, not an Unfinished set entry', wc.W4, JSON.stringify([WR.w4SetCancel, WR.w4Closed, WR.w4Deleted, WR.w4Writes, WR.w4Engine, WR.w4Abandoned, WR.w4Err]));
  ok('W5 Save: the set’s My Sets row first, THEN the 2332, its box and its sheet join the set', wc.W5, JSON.stringify([WR.w5Step, WR.w5Rows, WR.w5Order, WR.w5Engine, WR.w5Toast]));
  ok('W6 Save pressed twice: one My Sets row, each piece written once', wc.W6 && wc.W5, JSON.stringify([WR.w6MySets, WR.w5Rows]));
  ok('W7 a second link call writes nothing and refuses nothing (one at a time, or two at once)', wc.W7, WR.w7 + ' / ' + WR.w7b);
  ok('W8 the set’s row fails to save: the 2332 is not linked', wc.W8, JSON.stringify([WR.w8Writes, WR.w8Engine]));
  ok('W9 the copy went into another set meanwhile: the set saves, the toast says the 2332 did not join', wc.W9, JSON.stringify([WR.w9Writes, WR.w9MySets, WR.w9Toast]));
  ok('W10 "Add Another Item" set walk: the real save records only the row it added; Cancel names it and deletes only it — the item it started from and its box stay', wc.W10, JSON.stringify([WR.w10Tab, WR.w10Gid, WR.w10New, WR.w10Added, WR.w10AddedIsNew, WR.w10Asked, (WR.w10Text || '').slice(0, 140), WR.w10List, WR.w10Deleted, WR.w10Orig, WR.w10NewGone, WR.w10SaveErr, WR.w10Err]));
  ok('W11 "Yes, Delete All" pressed twice deletes once', wc.W11 && wc.W10, String(WR.w10Deleted));
  ok('W12 rows another device brings in DURING the save (a refresh) are not recorded as the walk\u2019s', wc.W12, String(WR.w12Rec) + ' ' + (WR.w12Err || ''));
  ok('W13 the outbox re-mints the piece\u2019s id (another real item wears it): Cancel never deletes that item; it follows the piece to its new id and deletes only it', wc.W13, JSON.stringify([WR.w13Before, WR.w13After, WR.w13Deleted, WR.w13Others, WR.w13Err]));
  ok('W14 a quick-entry walk save that fails half-way still records the row it stored; Cancel takes it back', wc.W14, JSON.stringify([WR.w14New, WR.w14Rec, WR.w14Asked, WR.w14Deleted, WR.w14NewRows, WR.w14Err, WR.w14CloseErr]));
  ok('W15 an "Add Another Item" set whose only piece is "use the one I have" links it (and the set) to THAT item\u2019s group, not a SET- group', wc.W15, JSON.stringify([WR.w15Step, WR.w15SetGid, WR.w15Engine, WR.w15Rows]));
  ok('W16 a walk save that throws AFTER storing its box: the record in saveWizardItem\u2019s finally takes the box; Cancel removes it', wc.W16, JSON.stringify([WR.w16New, WR.w16Rec, WR.w16Asked, WR.w16BoxRow, WR.w16Deleted, WR.w16BoxGone, WR.w16Err]));
  ok('W17 a piece saved OFFLINE: Cancel takes its queued add back out of the outbox; one that cannot be taken back is kept, and said', wc.W17, JSON.stringify([WR.w17QueuedBefore, WR.w17Asked, WR.w17QueuedAfter, WR.w17Gone, WR.w17Deleted, WR.w17bKept, WR.w17bToast, WR.w17Err]));
  ok('W18 a box you already had, linked in on a piece\u2019s Confirm step, goes back to no group on Cancel', wc.W18, JSON.stringify([WR.w18Adopted, WR.w18Asked, WR.w18After, WR.w18Writes, WR.w18Err]));
  ok('W19 a temp_ key follows a re-mint (key and id); a re-keyed row is found again by its id', wc.W19, JSON.stringify([WR.w19Key, WR.w19Now, WR.w19Stale]));
  ok('W20 an offline piece re-minted, its send then failed (memory: the old id; queue: the fresh one): Cancel finds it and takes the queued add back', wc.W20, JSON.stringify([WR.w20MemOld, WR.w20QueuedY, WR.w20Asked, WR.w20QueuedAfter, WR.w20Gone, WR.w20Err]));
  ok('W  no page errors', wErrs.length === 0, wErrs.slice(0, 3).join(' | '));

  }
  if (on('remove')) {
  // ── Item 3 ──
  const RD = await removeWalk(browser, DESK);
  const RP = await removeWalk(browser, PHONE);
  const rc = removeChecks(RD), rp = removeChecks(RP);
  const S = (o) => JSON.stringify(o).slice(0, 400);
  ok('R1 computer: removed from its page (opened from My Sets) — the page closes, My Sets shows without it', rc.R1, S([RD.onPage, RD.afterKeep]));
  ok('R1 phone: the same', rp.R1, S([RP.onPage, RP.afterKeep]));
  ok('R2 the question: the name, "pieces stay in your collection either way", two choices, Keep picked, no "remove the pieces"', rc.R2 && rp.R2, S(RD.dlg));
  ok('R3 Keep: every piece keeps its group, nothing written to them, not an "Unfinished set entry"; a real one still is', rc.R3 && rp.R3, S(RD.afterKeep));
  ok('R4 Break up: through the app’s own _breakUpGroup, all pieces still in the collection; page closes to My Collection', rc.R4, S([RD.dlg2, RD.afterBreak]));
  ok('R5 a set with no pieces: says only its entry goes, no choice', rc.R5, S([RD.dlg3, RD.afterAlone]));
  ok('R6 Cancel: nothing changes, the page stays', rc.R6, S(RD.afterCancel));
  ok('R7 the sheet refuses: the set comes back, the pieces are untouched (even with Break up chosen)', rc.R7, S(RD.afterRefused));
  ok('R8 removed from the list (not its page): no page change', rc.R8, S(RD.afterAlone));
  const R2 = await removeWalk2(browser);
  const r2 = remove2Checks(R2);
  ok('R9 Keep is written BEFORE the set leaves memory (never shown as an "Unfinished set entry" in between); a refused sheet write takes it back', r2.R9, S([R2.refusedKept, R2.refusedSets, R2.during, R2.keptAfter]));
  ok('R10 the "Unfinished set entry" notice UNLINKS (the app\u2019s Break Up Group) and never deletes a row', r2.R10, S([R2.noticeBtn, R2.leftDlg, R2.leftAfter]));
  ok('R11 the kept-groups setting is combined on every device meeting (RR_PREF_ALWAYS_UNION), keeps and retires both survive', r2.R11, S(R2.union));
  ok('R12 a set made through "Add Another Item" (it shares the item\u2019s group): the question says so, and what "break up" covers', r2.R12, S(R2.sharedDlg));
  ok('R13 a kept group that is broken up is no longer kept', r2.R13, S(R2.keptAfterBreak));
  ok('R14 a break-up here never retires ANOTHER collection\u2019s kept group (only the group just touched is pruned)', r2.R14, S(R2.otherKept));
  const rErrs = [].concat(RD.errs || [], RP.errs || [], R2.errs || []).filter(e => !/fonts|Failed to fetch|net::/i.test(e));
  ok('R  no page errors', rErrs.length === 0, rErrs.slice(0, 3).join(' | '));

  }
  if (on('walk')) {
  // ── S — source ──
  const cfg = rd('config.js'), br = rd('browse.js'), ws = rd('wizard-save.js');
  const body = (src, sig) => { const at = src.indexOf(sig); return at < 0 ? '' : src.slice(at, src.indexOf('\n}', at) + 2); };
  const rmBody = body(br, 'async function _removeOwnedSet(');
  ok('S1 the words live in config.js (RR_SET_REMOVE; RR_LINK_OWNED.setFlow willJoin / cancelKeeps / notJoined)',
     /const RR_SET_REMOVE = \{/.test(cfg) && /keep:\s+'Keep the pieces grouped'/.test(cfg) && /breakUp:\s+'Break up the group'/.test(cfg) && /willJoin:/.test(cfg) && /cancelKeepsOne:/.test(cfg) && /notJoined:/.test(cfg)
     && !/'Keep the pieces grouped'|'Break up the group'|'\\u2713 \{num\} joins/.test(br + ws));
  ok('S2 _removeOwnedSet never deletes a piece: no row delete, no group removal, no item removal, no copy of Break Up Group',
     rmBody.length > 200 && !/sheetsDeleteRow|rrRemoveSetGroup|removeCollectionItem|personalColLetter\('groupId'\)/.test(rmBody) && /_breakUpGroup\(/.test(rmBody));
  const qe = rd('wizard-quickentry.js'), wz = rd('wizard.js');
  const qeBody = body(qe, 'async function quickEntryAdd(');
  const swBody = body(ws, 'async function saveWizardItem(');
  const recCount = (t) => (t.match(/rrSetWalkRecordAdded\(d, _rrSetBefore, \{ gid: /g) || []).length;
  ok('S4 both walk saves record what they add — snapshot first, then in the set branch AND when the save fails half-way (saveWizardItem: its finally; quickEntryAdd: its catch); the finished saves never read the list',
     /var _rrSetBefore = d\._setMode \? Object\.keys\(state\.personalData/.test(swBody) && recCount(swBody) === 2 && /\} finally \{[\s\S]{0,400}rrSetWalkRecordAdded\(d, _rrSetBefore/.test(swBody)
     && /const _rrSetBefore = d\._setMode \? Object\.keys\(state\.personalData/.test(qeBody) && recCount(qeBody) === 2 && /\} catch\(e\) \{[\s\S]{0,500}rrSetWalkRecordAdded\(d, _rrSetBefore/.test(qeBody)
     && !/_setAddedKeys/.test(body(ws, 'async function saveSet(')) && !/_setAddedKeys/.test(body(ws, 'async function _quickEntrySaveSet(')));
  ok('S5 the walk\u2019s Cancel deletes through the list (rrRemoveSetGroup(groupId, _addedKeys)); no other cancel deletes by Group ID',
     /rrRemoveSetGroup\(groupId, _addedKeys, _rmReport\)/.test(body(wz, 'async function _confirmSetCancel(')) && (wz.match(/rrRemoveSetGroup\(/g) || []).length === 2);
  ok('S6 nothing deletes "every row with this Group ID": rrRemoveSetGroup needs its list; browse.js never calls it',
     /if \(!groupId \|\| !Array\.isArray\(onlyKeys\) \|\| !onlyKeys\.length\) return 0;/.test(wz) && !/rrRemoveSetGroup\(/.test(br.replace(/\/\/[^\n]*/g, '')));
  ok('S3 one writer of the deferred link: rrSetLinkUsedOwned is called only by saveSet',
     (ws.match(/rrSetLinkUsedOwned\(/g) || []).length === 2 && body(ws, 'async function saveSet(').indexOf('rrSetLinkUsedOwned(') > 0);

  {
  // the source checks, on planted text
  {
    const bad = rmBody.replace("await _breakUpGroup(lead);", "await rrRemoveSetGroup(gid);");
    ok('P17 S2 catches a removal that deletes the pieces — caught', bad !== rmBody && /sheetsDeleteRow|rrRemoveSetGroup|removeCollectionItem/.test(bad));
    const qeBad = qeBody.split("rrSetWalkRecordAdded(d, _rrSetBefore, { gid: d._setGroupId, minted: _qeMinted })").join("void 0");
    ok('P23 S4 catches a quick-entry walk save that does not record — caught', qeBad !== qeBody && recCount(qeBad) !== 2);
    const swBad = swBody.replace(/\} finally \{\n    d\._wizSaveLock = false;[\s\S]*?\} catch \(eAdF\) \{\}/, '} finally {\n    d._wizSaveLock = false;');
    ok('P23b S4 catches a saveWizardItem with no record on a half-way failure — caught', swBad !== swBody && recCount(swBad) !== 2);
    const wzBad = wz.replace("rrRemoveSetGroup(groupId, _addedKeys, _rmReport)", "rrRemoveSetGroup(groupId)");
    ok('P24 S5 catches a cancel that deletes by Group ID — caught', wzBad !== wz && !/rrRemoveSetGroup\(groupId, _addedKeys, _rmReport\)/.test(body(wzBad, 'async function _confirmSetCancel(')));
    const bad2 = br.replace("rrEsc(W.choose)", "rrEsc('Keep the pieces grouped')");
    ok('P18 S1 catches a word typed in browse.js — caught', bad2 !== br && /'Keep the pieces grouped'|'Break up the group'/.test(bad2));
  }
  }
  }
  // ── P — planted offenders: undo one change in a served copy, its check goes red ──
  const plant = (n, from, to) => {
    const s = rd(n);
    if (s.indexOf(from) < 0) throw new Error('plant anchor missing in ' + n + ': ' + from.slice(0, 70));
    const out = s.split(from).join(to);
    if (out === s) throw new Error('plant did not change ' + n);
    return { [n]: out };
  };
  const both = (a, b) => Object.assign({}, a, b);
  // the old cancel: rrRemoveSetGroup deletes EVERY row carrying the Group ID (and ignores the list)
  const OLD_CANCEL = (() => {
    const s0 = rd('wizard.js');
    const g1 = "  if (!groupId || !Array.isArray(onlyKeys) || !onlyKeys.length) return 0;";
    const f1 = "  var keys = Object.keys(state.personalData).filter(function (k) {\n    var pd = state.personalData[k];\n    return !!pd && onlyKeys.indexOf(k) >= 0;\n  });";
    if (s0.indexOf(g1) < 0 || s0.indexOf(f1) < 0) throw new Error('OLD_CANCEL anchors missing');
    const out = s0.split(g1).join("  if (!groupId) return 0;")
      .split(f1).join("  var keys = Object.keys(state.personalData).filter(function (k) {\n    var pd = state.personalData[k];\n    return pd && pd.groupId === groupId;\n  });");
    if (out === s0) throw new Error('OLD_CANCEL did not change');
    return { 'wizard.js': out };
  })();
  const walkPlants = [
    // the old code: the pick stamps at once (rrLinkOwnedToGroup without checkOnly) — this is the PROOF of item 4
    ['P1 the pick stamps the engine at once (the old code) — W1', plant('wizard-save.js', "{ target: _setLbl, checkOnly: true }", "{ target: _setLbl }"), r => walkChecks(r).W1],
    // P1b is the WHOLE old code: the pick stamps at once AND the cancel deletes by Group ID —
    // the 2332 and its box are deleted (the check is "the engine was not deleted", nothing else)
    ['P1b …and then Cancel DELETES the engine Brad already had, and its box (the old code, both halves) — W3',
      both(plant('wizard-save.js', "{ target: _setLbl, checkOnly: true }", "{ target: _setLbl }"), OLD_CANCEL), r => /*W3*/ r.w3EngineNotDeleted],
    ['P2 the set saves without linking the picked copy — W5', plant('wizard-save.js', "      _ownedLink = await rrSetLinkUsedOwned(d, groupId,", "      _ownedLink = null && (d, groupId,"), r => walkChecks(r).W5],
    ['P3 no save lock: a double Save writes two My Sets rows — W6', plant('wizard-save.js', "  if (wizard.data._setSaveLock) {", "  if (false) {"), r => walkChecks(r).W6],
    ['P4 no link guard: a second call at once is refused (busy) — W7', plant('wizard-save.js', "  d._setOwnedLinked = true;\n", ''), r => walkChecks(r).W7],
    ['P5 the link before the set row is checked: the row fails, the engine is linked anyway — W8', plant('wizard-save.js',
      "    if (groupId && (d._setUsedOwned || []).length && typeof rrSetLinkUsedOwned === 'function') {\n      _ownedLink = await rrSetLinkUsedOwned(d, groupId, setNum ? ('Set ' + setNum) : ((isOwnSet ? d._ownSetName : '') || 'your set'));\n    }\n", ''),
      // (paired with a link at the very top of the write, before the row)
      r => walkChecks(r).W8 && walkChecks(r).W5],
    ['P6 the cancel counts the picked copy as an added piece (old count) — W4', plant('wizard.js', "if (_savedItems && _addedNow.length > 0 && _groupId) {", 'if (_savedItems && _savedItems.length > 0 && _groupId) {'), r => walkChecks(r).W4],
    ['P7 the cancel question does not say the 2332 stays — W3', plant('wizard.js', "(_keptLine ? '<div id=\"set-cancel-kept\"", "(false ? '<div id=\"set-cancel-kept\""), r => walkChecks(r).W3],
    // the old code: the cancel deletes every row with the walk's Group ID — this is the PROOF of the Add Another Item risk
    ['P19 the cancel deletes by Group ID (the old code): the item the walk started from goes too — W10', OLD_CANCEL, r => /*W10*/ r.w10Orig],
    ['P20 the walk\u2019s save does not record what it added — W10', plant('wizard-save.js', "rrSetWalkRecordAdded(d, _rrSetBefore, { gid: d._existingGroupId || d._setGroupId })", "void 0"), r => walkChecks(r).W10],
    ['P21 no guard on "Yes, Delete All": pressed twice deletes twice — W11', plant('wizard.js', "    if (overlay._rrDeleting) return;   // 2026-11-08 (setfix): one delete, however it is pressed\n", ''), r => walkChecks(r).W11],
    ['P22 the cancel question does not name what goes — W10', plant('wizard.js', "(_addedNums.length ? ': <span id=\"set-cancel-list\">'", "(false ? ': <span id=\"set-cancel-list\">'"), r => walkChecks(r).W10],
    ['P31 every new row recorded, whatever its group (a refresh mid-save is taken for the walk\u2019s) — W12', plant('wizard-save.js', "    if (!ours) return;\n", ''), r => walkChecks(r).W12],
    ['P32 the cancel trusts the bare key (no match on id / number / group): another item under the old id is deleted — W13',
      plant('wizard.js', "    return !!p && p.owned && idsOf(r).indexOf(String(p.inventoryId || '')) >= 0 && String(p.itemNum || '') === String(r.num || '')\n      && String(p.groupId || '') === String(r.gid || '');", "    return !!p && p.owned;"), r => /*W13*/ r.w13Others && r.w13Before === ''],
    ['P43 a re-mint forgets the old id (memory still wears it until reload) — W20', plant('wizard-save.js', "          r.prev = (r.prev || []).concat([r.inv]);\n", ''), r => walkChecks(r).W20],
    ['P44 the queued add matched only by the id in memory, not the re-minted one — W20', plant('wizard.js', "              var _ids = [_c(pd.inventoryId)].concat(((report.ids && report.ids[key]) || []).map(_c));", "              var _ids = [_c(pd.inventoryId)];"), r => walkChecks(r).W20],
    ['P33 the walk does not follow a re-minted id — W13', plant('wizard-save.js', "  document.addEventListener('rr-remint', function (ev) {", "  document.addEventListener('rr-remint-planted-off', function (ev) {"), r => walkChecks(r).W13],
    ['P34 a quick-entry save that fails half-way records nothing — W14', plant('wizard-quickentry.js', "    try { if (_rrSetBefore && d._setMode && typeof rrSetWalkRecordAdded === 'function') rrSetWalkRecordAdded(d, _rrSetBefore, { gid: d._setGroupId, minted: _qeMinted }); } catch (eAdQ) {}\n", ''), r => walkChecks(r).W14],
    ['P35 saveSet links to the SET- id, not the item\u2019s group (old) — W15', plant('wizard-save.js', "  const groupId = ((typeof rrAddToGroupId === 'function') ? rrAddToGroupId(d) : '') || d._setGroupId || '';", "  const groupId = d._setGroupId || '';"), r => walkChecks(r).W15],
    ['P36 no record in saveWizardItem\u2019s finally (just that line) — W16', plant('wizard-save.js', "    try { if (_rrSetBefore && d._setMode) rrSetWalkRecordAdded(d, _rrSetBefore, { gid: d._existingGroupId || d._setGroupId }); } catch (eAdF) {}\n", ''), r => walkChecks(r).W16],
    ['P37 an offline piece dropped from memory while its queued add stays (old) — W17', plant('wizard.js', "        if (!(_wd > 0)) { report.kept.push(String(pd.itemNum || '')); continue; }\n      }", "      }"), r => walkChecks(r).W17],
    ['P38 the queued add never taken back — W17', plant('wizard.js', "        var _wd = (_fi && typeof window !== 'undefined' && typeof window.rrOutboxWithdrawAppend === 'function')", "        var _wd = (false)"), r => walkChecks(r).W17],
    ['P39 Cancel leaves an adopted box in the dead group — W18', plant('wizard.js', "    try { if (typeof rrSetWalkUnadopt === 'function') await rrSetWalkUnadopt(wizard.data); } catch (eUa) { console.warn('[wizard] cancelled set: un-adopt', eUa); }\n", ''), r => walkChecks(r).W18],
    ['P40 a re-mint updates the id but not a temp_ key (old) — W19', plant('wizard-save.js', "          r.key = String(x.to);\n          r.inv = String(x.to);", "          if (r.key === r.inv) r.key = String(x.to);\n          r.inv = String(x.to);"), r => walkChecks(r).W19],
    ['P41 no lookup by id for a re-keyed row — W19', plant('wizard.js', "      Object.keys(pdAll).some(function (k) { if (same(pdAll[k], r)) { key = k; return true; } return false; });\n", ''), r => walkChecks(r).W19],
    ['P8 a refused link at save is not said — W9', plant('wizard-save.js', "  if (_refused.length) {\n    const _nums", "  if (false) {\n    const _nums"), r => walkChecks(r).W9],
  ];
  // P5 needs the link moved ABOVE the row write to be a true "link first" offender
  walkPlants[5][1] = (() => {
    const s0 = rd('wizard-save.js');
    const moveFrom = "    if (groupId && (d._setUsedOwned || []).length && typeof rrSetLinkUsedOwned === 'function') {\n      _ownedLink = await rrSetLinkUsedOwned(d, groupId, setNum ? ('Set ' + setNum) : ((isOwnSet ? d._ownSetName : '') || 'your set'));\n    }\n";
    const anchor = "    const _msApRow2 = await sheetsAppend(state.personalSheetId, 'My Sets!A:A', [mySetsRow]);";
    if (s0.indexOf(moveFrom) < 0 || s0.indexOf(anchor) < 0) throw new Error('P5 anchors missing');
    const out = s0.split(moveFrom).join('').split(anchor).join(moveFrom + anchor);
    if (out === s0) throw new Error('P5 did not change');
    return { 'wizard-save.js': out };
  })();
  const ONLY = process.env.SETFIX_ONLY || '';
  for (const [pi, [name, served, check]] of walkPlants.entries()) {
    if (!(on('walkplants_a') && pi < 13) && !(on('walkplants_b') && pi >= 13)) continue;
    if (ONLY && name.indexOf(ONLY) !== 0) continue;
    // only the parts its check reads, each on a fresh page
    const parts = [...new Set((check.toString().match(/\bW\d+\b/g) || []).map(k => PART_OF[k]))];
    let r = { errs: [], unfinished: [] };
    for (const part of parts) {
      const o = await open(browser, DESK, served);
      try { Object.assign(r, await walkScenario(o.pg, part)); } catch (e) { r.unfinished.push(part); }
      await o.pg.close().catch(() => {});
    }
    if (r.unfinished.length) r = null;
    let still = true; try { still = !r || !!check(r); } catch (e) { still = true; }
    ok(name + ' — caught', !still, r ? 'the check still passed' : 'the planted run did not finish (it must reach the check and turn it red)');
  }
  const removePlants = [
    ['P9 the page stays open after Remove (no leave) — R1', plant('browse.js', "    if (opts.fromPage && typeof rrGoToCollectionAfterRemove === 'function') {", "    if (false) {"), r => removeChecks(r).R1],
    ['P10 the page’s Remove does not say it came from the page — R1', plant('app-collection.js', "',&apos;page&apos;)\" style=\"padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--border)", "')\" style=\"padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--border)"), r => removeChecks(r).R1],
    ['P11 the old question (no word about the pieces, no choice) — R2', plant('browse.js', "  if (n) {\n    const opt = function", "  if (false) {\n    const opt = function"), r => removeChecks(r).R2],
    ['P12 "Break up" picked by default — R2/R3', both(plant('browse.js', "opt('keep', W.keep, W.keepDesc, true)", "opt('keep', W.keep, W.keepDesc, false)"), {}), r => removeChecks(r).R2],
    ['P13 the choice ignored: Keep breaks up the group anyway — R3', plant('browse.js', "    if (n && choice === 'break') {", "    if (n) {"), r => removeChecks(r).R3],
    ['P14 kept pieces still called an "Unfinished set entry" — R3', plant('browse.js', "    if (typeof rrSetKeptGroups === 'function') rrSetKeptGroups().forEach(function (g) { known[g] = 1; });", ''), r => removeChecks(r).R3],
    ['P15 Break up does nothing (not the app’s _breakUpGroup) — R4', plant('browse.js', "      if (lead && typeof _breakUpGroup === 'function') await _breakUpGroup(lead);", ''), r => removeChecks(r).R4],
    ['P16 a refused sheet write leaves the set off the screen — R7', plant('browse.js', "        if (!state.mySetsData[key]) state.mySetsData[key] = entry;   // it is still on the sheet", "        // planted   // it is still on the sheet"), r => removeChecks(r).R7],
  ];
  const remove2Plants = [
    ['P25 Keep written only after the set left memory (old order) — R9', plant('browse.js', "  if (keepIt) _rrSetKeepGroup(gid, true);\n  try {", "  try {"), r => remove2Checks(r).R9],
    ['P26 a refused sheet write leaves the keep in place — R9', plant('browse.js', "        if (keepIt) _rrSetKeepGroup(gid, false);   // the set is still there — nothing to keep\n", ''), r => remove2Checks(r).R9],
    ['P27 the leftover notice deletes by Group ID (old) — R10', plant('browse.js', "    if (lead && typeof _breakUpGroup === 'function') await _breakUpGroup(lead);\n    showToast(String(W.done",
      "    for (var _k in state.personalData) { var _p = state.personalData[_k]; if (_p && _p.groupId === gid) { await sheetsDeleteRow(state.personalSheetId, PERSONAL_TAB, _p.row, {}); delete state.personalData[_k]; } }\n    showToast(String(W.done"), r => remove2Checks(r).R10],
    ['P28 the setting is newest-wins (not combined) — R11', plant('config.js', "  rr_set_kept_groups: function (a, d) { return window.rrSetKeptUnion(a, d); },\n", ''), r => remove2Checks(r).R11],
    ['P29 a shared group is not said — R12', plant('browse.js', "    const shared = !/^(SET|OWN)-/i.test(gid);", "    const shared = false;"), r => remove2Checks(r).R12],
    ['P30 a broken-up group stays kept for ever — R13', plant('app-collection.js', "  try { if (typeof rrSetKeptPrune === 'function') rrSetKeptPrune(gid); } catch (eKp) {}\n", ''), r => remove2Checks(r).R13],
    ['P42 the prune sweeps every kept group, not the one touched (old) — R14', plant('browse.js', "    if (rrSetKeptGroups().indexOf(gid) >= 0 && !_rrSetPieceKeys(gid).length) _rrSetKeepGroup(gid, false);",
      "    rrSetKeptGroups().forEach(function (g) { if (!_rrSetPieceKeys(g).length) _rrSetKeepGroup(g, false); });"), r => remove2Checks(r).R14],
  ];
  for (const [name, served, check] of remove2Plants) {
    if (!on('removeplants_b')) continue;
    if (ONLY && name.indexOf(ONLY) !== 0) continue;
    let r = null;
    try { r = await removeWalk2(browser, served); } catch (e) { r = null; }
    let still = true; try { still = !r || !!check(r); } catch (e) { still = true; }
    ok(name + ' — caught', !still, r ? 'the check still passed' : 'the planted run did not finish (it must reach the check and turn it red)');
  }
  for (const [name, served, check] of removePlants) {
    if (!on('removeplants_a')) continue;
    if (ONLY && name.indexOf(ONLY) !== 0) continue;
    let r = null;
    try { r = await removeWalk(browser, DESK, served); } catch (e) { r = null; }
    let still = true; try { still = !r || !!check(r); } catch (e) { still = true; }
    ok(name + ' — caught', !still, r ? 'the check still passed' : 'the planted run did not finish (it must reach the check and turn it red)');
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  ' + suiteName + '  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
module.exports = { runSection, open, walkScenario, walkChecks, removeWalk2, remove2Checks, DESK };
