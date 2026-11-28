// ═══════════════════════════════════════════════════════════════════════════
// upgrade_sets_tests.js — 2026-11-25 (upgradesets)
//
// [stated] Brad 2026-11-25 15:40 CT "Fix now" — after #62 wantsets made a set
// ONE row on the Want list, the Upgrade list folded a set into one row too, but
// Got It and Remove there still acted on the lead's copy only (the second A /
// tender stayed on the Upgrade list).
//
// These run the REAL functions lifted out of app-pages.js / wizard-save.js on a
// Lionel 2343 family: the ONE partner finder + grouping seed now shared by the
// Want list's and the Upgrade list's Got It, Remove on an Upgrade set, Got It
// on an Upgrade set, and the save step that takes every piece off. Section P
// plants the old shapes back, one at a time, and each must go red.
//
// Run: node tests/upgrade_sets_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name, prefix) {
  const i = src.indexOf((prefix || 'function ') + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const SRC = { app: APP('app.js'), pages: APP('app-pages.js'), save: APP('wizard-save.js'), gift: APP('gift-list.js'), wiz: APP('wizard.js') };

// ── the catalog rows (as the Postwar tab files the 2343 family) ─────────────
const PW = (num, unit, pd) => ({ _tab: 'Lionel PW - Items', _era: 'pw', itemNum: num, description: 'F3 Diesel', itemType: 'Diesel Locomotive', subType: 'EMD F-3', unit, poweredDummy: pd, roadName: 'Santa Fe' });
const ROWS = [PW('2343', 'A', 'P'), PW('2343T', 'A', 'D'), PW('2343C', 'B', 'C'), PW('2245', 'A', 'P'), PW('2245C', 'B', 'C')];

// ── THE fold + its helpers, from app.js, on one shared state ────────────────
const FOLD_HELPERS = ['rrMthUnitRole', 'buildPartnerMap', '_stripSuffix', '_getPartner', 'isTender', 'isLocomotive', 'getMatchingTenders', 'getBUnit', 'getAUnit',
  'getADummyPartner', 'getSetPartner', 'normalizeItemNum', 'baseItemNum', '_wantGroupOf', '_wantOwnedGroupOf', '_wantPieceKey', '_wantIsCompanion', 'foldWantEntries', 'wantSetLabel'];
function foldWorld(appSrc) {
  const state = { masterData: ROWS, companionData: [], setData: [], personalData: {}, wantData: {} };
  const win = {};
  const gcl = appSrc.slice(appSrc.indexOf('window.groupConfigLabel = function'));
  const gclFn = gcl.slice(gcl.indexOf('function'), (function () { let d = 0; for (let k = gcl.indexOf('{'); k < gcl.length; k++) { if (gcl[k] === '{') d++; else if (gcl[k] === '}') { d--; if (!d) return k + 1; } } })());
  const code = FOLD_HELPERS.map(n => grab(appSrc, n)).join('\n') + '\nwindow.groupConfigLabel = ' + gclFn + ';\nreturn { ' + FOLD_HELPERS.join(', ') + ' };';
  const W = new Function('state', 'console', 'window', code)(state, { log() {}, warn() {} }, win);
  W.buildPartnerMap();
  W.state = state; W.window = win;
  return W;
}


// ── H · the ONE partner finder + grouping seed ─────────────────────────────
function sharedChecks(pagesSrc) {
  const r = {};
  const W = foldWorld(SRC.app);
  const H = new Function('state', 'normalizeItemNum', 'baseItemNum', 'genSetId',
    grab(pagesSrc, '_wcNorm') + '\n' + grab(pagesSrc, '_wcPartnersOf') + '\n' + grab(pagesSrc, '_wcSeedGrouping') + '\nreturn { _wcNorm, _wcPartnersOf, _wcSeedGrouping };')(
    W.state, W.normalizeItemNum, W.baseItemNum, n => 'set-' + n);
  const p = H._wcPartnersOf('2343-P');
  r.partners = p.dummy === '2343T' && p.bunit === '2343C' && p.tender === '';
  const d = {}; H._wcSeedGrouping(d, '2343-P', '', '', '2343T');
  r.seedAA = d._itemGrouping === 'aa' && d.unit2ItemNum === '2343T' && d.unit2Power === 'Dummy' && d.setType === 'AA' && d.setMatch === 'set-now' && !!d._setId;
  const d2 = {}; H._wcSeedGrouping(d2, '2343-P', '', '2343C', '2343T');
  r.seedABA = d2._itemGrouping === 'aba' && d2.unit2ItemNum === '2343C' && d2.unit3ItemNum === '2343T';
  const d3 = {}; H._wcSeedGrouping(d3, '6520', '', '', '');
  r.seedSingle = d3._itemGrouping === 'single' && d3.unit2ItemNum === undefined;
  const mw = grab(pagesSrc, 'moveWantToCollection');
  r.wantUsesShared = /_wcPartnersOf\(itemNum\)/.test(mw) && /_wcSeedGrouping\(wizard\.data, itemNum, _wcTender, _wcBunit, _wcDummy\)/.test(mw)
    && !/companionData/.test(mw) && !/_itemGrouping = 'aa'/.test(mw);
  const ug = grab(pagesSrc, 'upgradeGotIt');
  r.upgradeUsesShared = /_wcPartnersOf\(itemNum\)/.test(ug) && /_wcSeedGrouping\(wizard\.data, itemNum/.test(ug) && !/companionData/.test(ug);
  return r;
}

// ── I · the Upgrade page folds a set into one row that knows its pieces ────
function pageChecks(pagesSrc, appSrc) {
  const r = {};
  const body = grab(pagesSrc, 'buildUpgradePage');
  const inner = grab(body, '_wuFoldPairs');
  const W = foldWorld(appSrc || SRC.app);
  const fp = new Function('foldWantEntries', inner + '\nreturn _wuFoldPairs;')(W.foldWantEntries);
  const rows = fp([
    { itemNum: '2343-P', variation: '', maxPrice: '300', listType: 'Upgrade', inventoryId: 'INV76', row: 21 },
    { itemNum: '2343T', variation: '', maxPrice: '150', listType: 'Upgrade', inventoryId: 'INV77', row: 22 },
    { itemNum: '6520', variation: '', maxPrice: '90', listType: 'Upgrade', inventoryId: 'INV80', row: 23 }]);
  const lead = rows.find(e => e.itemNum === '2343-P') || {};
  r.oneRow = rows.length === 2 && (lead._mateRows || []).length === 1 && lead._mateRows[0].inventoryId === 'INV77';
  const K = new Function(grab(pagesSrc, '_ugEntryKey') + '\n' + grab(pagesSrc, '_wuMateKeys') + '\nreturn { _ugEntryKey, _wuMateKeys };')();
  r.mateKeys = K._wuMateKeys(lead) === 'INV77' && K._wuMateKeys({ itemNum: '6520' }) === '';
  const P = new Function(grab(pagesSrc, '_wuPriceOf') + '\nreturn _wuPriceOf;')();
  r.price = P(lead, false) === '450' && P({ itemNum: '6520', maxPrice: '90' }, false) === '90'
    && P({ itemNum: '2343-P', _wantMates: ['2343T'], _pairPrice: '350', expectedPrice: '350', _mateRows: [{}] }, true) === '350';
  r.gotItHands = /upgradeGotIt\('" \+ rrJsArg\(_ugEntryKey\(u\)\) \+ "','" \+ rrJsArg\(_wuMateKeys\(u\)\) \+ "'\)/.test(grab(pagesSrc, '_wuMain'));
  r.removeHands = /removeUpgradeItemAsk\(_ugEntryKey\(u\), _wuMateKeys\(u\)\)/.test(grab(pagesSrc, '_wuMenu'));
  return r;
}

// ── J · Remove on an Upgrade set ────────────────────────────────────────────
async function removeChecks(pagesSrc) {
  const r = {};
  async function run(key, mates, refuse) {
    const state = { personalSheetId: 'S', upgradeData: {
      INV76: { itemNum: '2343-P', row: 21, inventoryId: 'INV76' }, INV77: { itemNum: '2343T', row: 22, inventoryId: 'INV77' }, INV80: { itemNum: '6520', row: 23, inventoryId: 'INV80' } } };
    const log = { asked: '', rows: [], toasts: 0 };
    const fns = new Function('state', 'appConfirm', 'rrVerifiedRowUpdate', 'buildUpgradePage', 'buildDashboard', 'showToast', 'document', 'wishlistFoldedCount',
      grab(pagesSrc, 'removeUpgradeItemAsk', 'async function ') + '\n' + grab(pagesSrc, 'removeUpgradeItem', 'async function ') + '\nreturn removeUpgradeItemAsk;')(
      state, async q => { log.asked = q; return true; }, async (sh, tab, row) => { log.rows.push(row); return !(refuse && refuse.indexOf(row) >= 0); },
      () => {}, () => {}, () => { log.toasts++; }, { getElementById() { return null; } }, () => 0);
    await fns(key, mates);
    return { state, log };
  }
  let o = await run('INV76', 'INV77');
  r.setAsk = /Remove this set \(2 pieces\) from your Upgrade List\?/.test(o.log.asked);
  r.setGone = !o.state.upgradeData.INV76 && !o.state.upgradeData.INV77 && !!o.state.upgradeData.INV80 && o.log.rows.join() === '21,22';
  r.oneToast = o.log.toasts === 1;
  o = await run('INV80', '');
  r.single = /Remove this item from your Upgrade List\?/.test(o.log.asked) && !o.state.upgradeData.INV80 && o.log.rows.join() === '23';
  o = await run('INV76', 'INV77', [21]);
  r.leadRefused = !!o.state.upgradeData.INV76 && !!o.state.upgradeData.INV77 && o.log.rows.join() === '21';
  return r;
}

// ── K · Got It on an Upgrade set adds the whole set ─────────────────────────
function gotItChecks(pagesSrc) {
  const r = {};
  const W = foldWorld(SRC.app);
  function run(key, mates) {
    const state = Object.assign(W.state, { upgradeData: {
      INV76: { itemNum: '2343-P', variation: '', row: 21, inventoryId: 'INV76' }, INV77: { itemNum: '2343T', variation: '', row: 22, inventoryId: 'INV77' },
      INV80: { itemNum: '6520', variation: '', row: 23, inventoryId: 'INV80' }, INV90: { itemNum: '9999X', variation: '', row: 24, inventoryId: 'INV90' } } });
    const STEPS = [{ id: 'itemCategory' }, { id: 'itemNumGrouping' }, { id: 'itemPicker' }, { id: 'conditionDetails' }, { id: 'confirm' }];
    const wizard = { data: {}, step: 0, steps: STEPS.slice() };
    const code = grab(pagesSrc, '_wcNorm') + '\n' + grab(pagesSrc, '_wcPartnersOf') + '\n' + grab(pagesSrc, '_wcSeedGrouping') + '\n' + grab(pagesSrc, 'upgradeGotIt') + '\nreturn upgradeGotIt;';
    const fn = new Function('state', 'wizard', 'openWizard', 'setTimeout', 'findMaster', '_partsOwnedRow', 'eraForTab', 'getSteps', 'renderWizardStep', 'showToast', 'normalizeItemNum', 'baseItemNum', 'genSetId', code)(
      state, wizard, () => {}, f => f(), () => ({ _tab: 'Lionel PW - Items' }), () => null, () => 'pw', () => STEPS.slice(), () => {}, () => {}, W.normalizeItemNum, W.baseItemNum, n => 'set-' + n);
    fn(key, mates);
    return wizard;
  }
  let w = run('INV76', 'INV77');
  // 2026-11-27 (gotitp): a set's lead is handed over BARE (2343) — the save puts -P on it; "2343-P" here saved 2343-P-P.
  r.aa = w.data._itemGrouping === 'aa' && w.data.unit2ItemNum === '2343T' && w.data.itemNum === '2343' && w.data._fromUpgradeKey === 'INV76';
  r.mateKeys = JSON.stringify(w.data._fromUpgradeMateKeys) === JSON.stringify([{ num: '2343T', key: 'INV77' }]);
  r.lands = w.steps[w.step] && w.steps[w.step].id === 'conditionDetails';
  w = run('INV80', '');
  r.single = w.data._itemGrouping === 'single' && w.data._fromUpgradeMateKeys === undefined && w.data.unit2ItemNum === undefined;
  w = run('INV76', 'INV90');   // a folded piece the catalog does not pair with 2343: not added as a partner
  r.notAPartner = w.data._itemGrouping === 'single' && !w.data.unit2ItemNum;
  return r;
}

// ── L · the save takes every piece it added off the Upgrade list ────────────
function saveChecks(saveSrc, wizSrc) {
  const r = {};
  const a = saveSrc.indexOf('// ── If this came from the Upgrade List, clean up the upgrade entry ──');
  const b = saveSrc.indexOf('// ── General case:', a);
  const block = saveSrc.slice(a, b) + '\n' + grab(saveSrc, '_wsPieceKey');   // 2026-11-27 (upgradesets3): the clean-up's same-piece rule
  function run(d) {
    const state = { personalSheetId: 'S', upgradeData: {
      INV76: { itemNum: '2343-P', row: 21, inventoryId: 'INV76' }, INV77: { itemNum: '2343T', row: 22, inventoryId: 'INV77' }, INV80: { itemNum: '6520', row: 23, inventoryId: 'INV80' } } };
    const rows = [], removed = [];
    new Function('d', 'tab', 'state', 'rrVerifiedRowUpdate', 'buildUpgradePage', 'showToast', 'console', 'removeUpgradeItem', block)(
      d, 'collection', state, (sh, t, row) => { rows.push(row); return Promise.resolve(true); }, () => {}, () => {}, { warn() {} },
      (k, o) => { removed.push(k + (o && o.quiet ? ':quiet' : '')); delete state.upgradeData[k]; return Promise.resolve(); });
    return { state, rows, removed };
  }
  const base = { _fromUpgradeList: true, _fromUpgradeKey: 'INV76', _fromUpgradeMateKeys: [{ num: '2343T', key: 'INV77' }] };
  let o = run(Object.assign({}, base, { _itemGrouping: 'aa', unit2ItemNum: '2343T' }));
  r.bothGone = !o.state.upgradeData.INV76 && !o.state.upgradeData.INV77 && !!o.state.upgradeData.INV80 && o.rows.join() === '21' && o.removed.join() === 'INV77:quiet';
  o = run(Object.assign({}, base, { _itemGrouping: 'single', unit2ItemNum: '' }));
  r.changedToSingle = !o.state.upgradeData.INV76 && !!o.state.upgradeData.INV77;
  o = run(Object.assign({}, base, { _itemGrouping: 'aa', unit2ItemNum: '2343X' }));
  r.otherPartner = !!o.state.upgradeData.INV77;
  o = run({ _fromUpgradeList: true, _fromUpgradeKey: 'INV80', _itemGrouping: 'single' });
  r.single = !o.state.upgradeData.INV80 && !!o.state.upgradeData.INV77 && o.rows.join() === '23' && !o.removed.length;
  r.notOnReview = /'_fromUpgradeMateKeys'/.test(wizSrc);
  return r;
}

(async () => {
  section('H · ONE partner finder + grouping seed, shared by both lists');
  const H = sharedChecks(SRC.pages);
  ok('_wcPartnersOf(2343-P) finds the second A (2343T) and the B unit (2343C) from the catalog', H.partners);
  ok('_wcSeedGrouping seeds an AA set: grouping aa, unit 2 = 2343T as the dummy', H.seedAA);
  ok('…an ABA set: B unit + dummy', H.seedABA);
  ok('…and no partners = a single piece', H.seedSingle);
  ok('the Want list\'s Got It uses the shared two (no partner loop of its own)', H.wantUsesShared);
  ok('the Upgrade list\'s Got It uses the SAME two', H.upgradeUsesShared);

  section('I · the Upgrade page: a set row knows its pieces');
  const I = pageChecks(SRC.pages);
  ok('2343-P + 2343T on the Upgrade list fold to ONE row that carries 2343T\'s entry', I.oneRow);
  ok('_wuMateKeys gives the other pieces\' keys ("INV77"); a single row gives none', I.mateKeys);
  ok('the set\'s price is its pieces\' target prices added up ($300 + $150 = $450); a want set and a single row unchanged', I.price);
  ok('the Got It button hands the pieces\' keys to upgradeGotIt', I.gotItHands);
  ok('the ⋯ Remove hands the pieces\' keys to removeUpgradeItemAsk', I.removeHands);

  section('J · Remove on an Upgrade set clears every piece');
  const J = await removeChecks(SRC.pages);
  ok('a set is asked about ONCE: "Remove this set (2 pieces) from your Upgrade List?"', J.setAsk);
  ok('…both pieces\' rows are cleared (21, 22); the other upgrade stays', J.setGone);
  ok('…with one "Removed" message, not one per piece', J.oneToast);
  ok('a single upgrade is asked and cleared as before', J.single);
  ok('if the sheet refuses the lead\'s row, nothing else is touched', J.leadRefused);

  section('K · Got It on an Upgrade set adds the whole set');
  const K = gotItChecks(SRC.pages);
  ok('Got It on the 2343 AA upgrade opens Add as an AA set from the bare 2343 (saves 2343-P + 2343T-D)', K.aa);
  ok('…and hands the save the second piece\'s upgrade key', K.mateKeys);
  ok('…landing on Condition & Details, like the Want list\'s Got It', K.lands);
  ok('a single upgrade opens as a single piece, as before', K.single);
  ok('a folded piece the catalog does not pair with the lead is not added as a partner', K.notAPartner);

  section('L · the save takes every piece it added off the Upgrade list');
  const L = saveChecks(SRC.save, SRC.wiz);
  ok('saved as the AA set: the lead\'s row AND 2343T\'s upgrade come off (through removeUpgradeItem, quietly)', L.bothGone);
  ok('changed to one piece on the way: only the lead comes off, 2343T stays on the Upgrade list', L.changedToSingle);
  ok('a different partner saved: 2343T\'s upgrade stays', L.otherPartner);
  ok('a single upgrade\'s Got It is unchanged', L.single);
  ok('_fromUpgradeMateKeys is an internal flag (never a review row)', L.notOnReview);

  // ── P · planted offenders — the old shapes, each must go red ──────────────
  section('P · planted offenders');
  const plant = (src, a, b) => { if (src.indexOf(a) < 0) throw new Error('plant anchor missing: ' + a.slice(0, 60)); return src.replace(a, b); };
  const p1 = await removeChecks(plant(SRC.pages, "  if (!_mates.length) return removeUpgradeItem(ugKey);\n", "  return removeUpgradeItem(ugKey);\n"));
  ok('P1 planted: Remove clears only the lead → 2343T is left behind (red)', !p1.setGone);
  const p2 = pageChecks(plant(SRC.pages, "removeUpgradeItemAsk(_ugEntryKey(u), _wuMateKeys(u))", "removeUpgradeItemAsk(_ugEntryKey(u))"));
  ok('P2 planted: the ⋯ Remove forgets the pieces → caught (red)', !p2.removeHands);
  const p3 = pageChecks(plant(SRC.pages, "\"','\" + rrJsArg(_wuMateKeys(u)) + \"')\"", "\"')\""));
  ok('P3 planted: the Got It button forgets the pieces → caught (red)', !p3.gotItHands);
  const p4 = gotItChecks(plant(SRC.pages, "    if (_ugMates.length) {\n      // 2026-11-27 (upgradesets3)", "    if (false) {\n      // 2026-11-27 (upgradesets3)"));
  ok('P4 planted: Got It does not seed the set → opens as one piece (red)', !p4.aa);
  const p5 = saveChecks(plant(SRC.save, "if ((d._itemGrouping || 'single') !== 'single' && typeof removeUpgradeItem === 'function') (d._fromUpgradeMateKeys || [])", "if (false) (d._fromUpgradeMateKeys || [])"), SRC.wiz);
  ok('P5 planted: the save clears only the lead → 2343T is left on the Upgrade list (red)', !p5.bothGone);
  const p6 = saveChecks(plant(SRC.save, "        if (!mk || !_umSaved.some(function (x) { return _wsPieceKey(x) === _wsPieceKey(mk.num); }) || !state.upgradeData[mk.key]) return;", "        if (!mk || !state.upgradeData[mk.key]) return;"), SRC.wiz);
  ok('P6 planted: the save clears a piece that was not the partner it saved → caught (red)', !p6.otherPartner);
  const p7 = sharedChecks(plant(SRC.pages, "    var _wcP = _wcPartnersOf(itemNum), _pTender = _wcP.tender, _pBunit = _wcP.bunit, _pDummy = _wcP.dummy;", "    var _pTender = '', _pBunit = '', _pDummy = ''; (state.companionData || []).forEach(function(){});"));
  ok('P7 planted: the Want list grows its own partner loop again → caught (red)', !p7.wantUsesShared);
  const p8 = await removeChecks(plant(SRC.pages, "  if (state.upgradeData[ugKey]) return;   // the lead could not be cleared: nothing changes\n", ""));
  ok('P8 planted: the lead refused but the rest cleared anyway → caught (red)', !p8.leadRefused);

  // 2026-11-27 (upgradesets3): an Upgrade set's price is worked out in the fold (app.js) now
  const p9 = pageChecks(SRC.pages, plant(SRC.app, "    if (_isUpg) {", "    if (false) {"));
  ok('P9 planted: the Upgrade set priced as the lead alone → caught (red)', !p9.price);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
