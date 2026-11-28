// ═══════════════════════════════════════════════════════════════════════════
// upgrade_set_three_tests.js — 2026-11-27 (upgradesets3)
//
// [stated] Brad 2026-11-27 09:19 CT "yes" to PLAN_2026-11-27_UPGRADE_SET_THREE_PIECES.md.
// T-2026-11-26-03 FAILED: Brad's 3-piece 2343 (2343-P + 2343C + 2343T-D) put on
// the Upgrade list with "Upgrade the whole set" ($300) showed "AB SET · 2
// pieces · $600" + a loose 2343T-D, and Remove left the dummy behind.
//
// The REAL fold (app.js), Remove / Got It (app-pages.js) and the save's
// clean-up (wizard-save.js), on a world where the owned copies carry their set:
//   T  the fold: an Upgrade row's group is its OWNED set; "2343T" = "2343T-D";
//      one price for a set saved whole, pieces priced one by one added up;
//      pieces of two DIFFERENT owned copies never pair; Want rows untouched
//   R  Remove on the 3-piece set clears all three
//   G  Got It seeds the ABA set; the save takes all three off
//   Q  planted offenders — each old shape put back turns its check red
// Run: node tests/upgrade_set_three_tests.js
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



// the owned copies: one 3-piece set (GRP-A), one more 2343-P in its own set (GRP-B),
// two loose copies with no set (2245-P, 2245C)
const OWNED = {
  a1: { itemNum: '2343-P', inventoryId: 'INV1', groupId: 'GRP-A', owned: true },
  a2: { itemNum: '2343C', inventoryId: 'INV2', groupId: 'GRP-A', owned: true },
  a3: { itemNum: '2343T-D', inventoryId: 'INV3', groupId: 'GRP-A', owned: true },
  b1: { itemNum: '2343-P', inventoryId: 'INV4', groupId: 'GRP-B', owned: true },
  b3: { itemNum: '2343T-D', inventoryId: 'INV6', groupId: 'GRP-C', owned: true },
  l1: { itemNum: '2245-P', inventoryId: 'INV7', owned: true },
  l2: { itemNum: '2245C', inventoryId: 'INV8', owned: true },
  d1: { itemNum: '2245-P', inventoryId: 'INV10', groupId: 'GRP-D', owned: true },   // a set of the collector's own making:
  d2: { itemNum: '6464-25', inventoryId: 'INV11', groupId: 'GRP-D', owned: true },  // the catalog links nothing here
  e1: { itemNum: '2343-P', inventoryId: 'INV12', groupId: 'GRP-E', owned: true },   // an engine kept with only its box
  e2: { itemNum: '2343-BOX', inventoryId: 'INV13', groupId: 'GRP-E', owned: true },
  f1: { itemNum: '2343C', inventoryId: 'INV14', owned: true },                      // a loose B unit
};
const UG = (inv, num, price, row) => ({ itemNum: num, variation: '', maxPrice: price, listType: 'Upgrade', inventoryId: inv, row, priority: 'Medium' });

function foldChecks(appSrc) {
  const r = {};
  const W = foldWorld(appSrc || SRC.app);
  W.state.personalData = OWNED;
  const F = rows => W.foldWantEntries(rows);
  // the whole set, $300 typed once → $300 on every piece
  let out = F([UG('INV1', '2343-P', '300', 21), UG('INV2', '2343C', '300', 22), UG('INV3', '2343T-D', '300', 23)]);
  const L = out[0] || {};
  r.oneRow = out.length === 1 && L.itemNum === '2343-P' && (L._mateRows || []).length === 2;
  r.label = W.wantSetLabel(L) === 'ABA SET · 3 pieces';
  r.onePrice = L._pairPrice === '300';
  // pieces of the SAME owned set upgraded one at a time: $300 + $100
  out = F([UG('INV1', '2343-P', '300', 21), UG('INV3', '2343T-D', '100', 23)]);
  r.oneByOne = out.length === 1 && out[0]._pairPrice === '400' && W.wantSetLabel(out[0]) === 'AA SET · 2 pieces';
  // pieces of two DIFFERENT owned sets never pair (GRP-B's engine, GRP-C's dummy)
  out = F([UG('INV4', '2343-P', '300', 31), UG('INV6', '2343T-D', '100', 32)]);
  r.twoOwners = out.length === 2 && !out.some(e => e._mateRows);
  // two loose copies (no set) still pair by the catalog — and "2343T-D" style names match
  out = F([UG('INV7', '2245-P', '200', 41), UG('INV8', '2245C', '90', 42)]);
  r.loosePair = out.length === 1 && out[0]._pairPrice === '290';
  // a set the catalog knows nothing about folds by the owned set alone
  out = F([UG('INV10', '2245-P', '250', 51), UG('INV11', '6464-25', '250', 52)]);
  r.ownOnly = out.length === 1 && out[0]._pairPrice === '250' && W.wantSetLabel(out[0]) === 'SET · 2 pieces';
  // review 2026-11-27: loose pieces priced the SAME are still added up ($150 + $150)
  out = F([UG('INV7', '2245-P', '150', 41), UG('INV8', '2245C', '150', 42)]);
  r.looseSame = out.length === 1 && out[0]._pairPrice === '300';
  // review 2026-11-27: an engine kept with only its box still pairs with a loose B unit
  out = F([UG('INV12', '2343-P', '300', 61), UG('INV14', '2343C', '100', 62)]);
  r.boxOnly = out.length === 1 && out[0]._pairPrice === '400' && W.wantSetLabel(out[0]) === 'AB SET · 2 pieces';
  // an Upgrade added from a list row (no listType yet, price in expectedPrice) still prices
  out = F([{ itemNum: '2343-P', variation: '', expectedPrice: '300', inventoryId: 'INV1' }, { itemNum: '2343C', variation: '', expectedPrice: '300', inventoryId: 'INV2' }]);
  r.untagged = out.length === 1 && out[0]._pairPrice === '300';
  // a Want set is untouched: its own mark, one price
  out = F([{ itemNum: '2343-P', variation: '', expectedPrice: '350', listType: 'Want', notes: '[grp:G9] x' },
           { itemNum: '2343T', variation: '', expectedPrice: '350', listType: 'Want', notes: '[grp:G9] x' }]);
  r.wantSame = out.length === 1 && out[0]._pairPrice === '350';
  // one rule for "the same piece"
  r.pieceKey = W._wantPieceKey('2343T-D') === W._wantPieceKey('2343T') && W._wantPieceKey('2343-P') !== W._wantPieceKey('2343T')
    && W._wantPieceKey('2343 t-d') === '2343T' && W._wantPieceKey('20-2014-1') === '2020141'
    && W._wantPieceKey('2343-D') !== W._wantPieceKey('2343');   // review 2026-11-27: a quick-entry "2343-D" is not the bare 2343
  return r;
}

async function removeChecks(pagesSrc) {
  const r = {};
  const state = { personalSheetId: 'S', upgradeData: {
    INV1: { itemNum: '2343-P', row: 21, inventoryId: 'INV1' }, INV2: { itemNum: '2343C', row: 22, inventoryId: 'INV2' },
    INV3: { itemNum: '2343T-D', row: 23, inventoryId: 'INV3' }, INV9: { itemNum: '6520', row: 24, inventoryId: 'INV9' } } };
  const log = { asked: '', rows: [] };
  const fn = new Function('state', 'appConfirm', 'rrVerifiedRowUpdate', 'buildUpgradePage', 'buildDashboard', 'showToast', 'document', 'wishlistFoldedCount',
    grab(pagesSrc, 'removeUpgradeItemAsk', 'async function ') + '\n' + grab(pagesSrc, 'removeUpgradeItem', 'async function ') + '\nreturn removeUpgradeItemAsk;')(
    state, async q => { log.asked = q; return true; }, async (sh, tab, row) => { log.rows.push(row); return true; },
    () => {}, () => {}, () => {}, { getElementById() { return null; } }, () => 0);
  // the page hands the folded row's other pieces (from the fold above)
  const W = foldWorld(SRC.app); W.state.personalData = OWNED;
  const lead = W.foldWantEntries(Object.values(state.upgradeData).map(u => Object.assign({ listType: 'Upgrade', maxPrice: '300' }, u)))
    .find(e => e.itemNum === '2343-P');
  const mates = ((lead && lead._mateRows) || []).map(m => m.inventoryId).join('|');
  await fn('INV1', mates);
  r.asks3 = /Remove this set \(3 pieces\) from your Upgrade List\?/.test(log.asked);
  r.all3 = !state.upgradeData.INV1 && !state.upgradeData.INV2 && !state.upgradeData.INV3 && !!state.upgradeData.INV9 && log.rows.sort().join() === '21,22,23';
  return r;
}

function gotItChecks(pagesSrc, appSrc) {
  const r = {};
  const W = foldWorld(appSrc || SRC.app);
  W.state.personalData = OWNED;
  W.state.upgradeData = {
    INV1: { itemNum: '2343-P', variation: '', row: 21, inventoryId: 'INV1' }, INV2: { itemNum: '2343C', variation: '', row: 22, inventoryId: 'INV2' },
    INV3: { itemNum: '2343T-D', variation: '', row: 23, inventoryId: 'INV3' } };
  const STEPS = [{ id: 'itemCategory' }, { id: 'itemNumGrouping' }, { id: 'itemPicker' }, { id: 'conditionDetails' }, { id: 'confirm' }];
  const wizard = { data: {}, step: 0, steps: STEPS.slice() };
  const code = grab(pagesSrc, '_wcNorm') + '\n' + grab(pagesSrc, '_wcPartnersOf') + '\n' + grab(pagesSrc, '_wcSeedGrouping') + '\n' + grab(pagesSrc, 'upgradeGotIt') + '\nreturn upgradeGotIt;';
  const fn = new Function('state', 'wizard', 'openWizard', 'setTimeout', 'findMaster', '_partsOwnedRow', 'eraForTab', 'getSteps', 'renderWizardStep', 'showToast', 'normalizeItemNum', 'baseItemNum', 'genSetId', '_wantPieceKey', code)(
    W.state, wizard, () => {}, f => f(), () => ({ _tab: 'Lionel PW - Items' }), () => null, () => 'pw', () => STEPS.slice(), () => {}, () => {}, W.normalizeItemNum, W.baseItemNum, n => 'set-' + n, W._wantPieceKey);
  fn('INV1', 'INV2|INV3');
  const d = wizard.data;
  r.aba = d._itemGrouping === 'aba' && d.unit2ItemNum === '2343C' && d.unit3ItemNum === '2343T';
  r.mates = JSON.stringify(d._fromUpgradeMateKeys) === JSON.stringify([{ num: '2343C', key: 'INV2' }, { num: '2343T-D', key: 'INV3' }]);
  r.lands = (wizard.steps[wizard.step] || {}).id === 'conditionDetails';
  return r;
}

function saveChecks(saveSrc) {
  const r = {};
  const a = saveSrc.indexOf('// ── If this came from the Upgrade List, clean up the upgrade entry ──');
  const b = saveSrc.indexOf('// ── General case:', a);
  const block = saveSrc.slice(a, b) + '\n' + grab(saveSrc, '_wsPieceKey');
  function run(d) {
    const state = { personalSheetId: 'S', upgradeData: {
      INV1: { itemNum: '2343-P', row: 21, inventoryId: 'INV1' }, INV2: { itemNum: '2343C', row: 22, inventoryId: 'INV2' }, INV3: { itemNum: '2343T-D', row: 23, inventoryId: 'INV3' } } };
    const removed = [];
    new Function('d', 'tab', 'state', 'rrVerifiedRowUpdate', 'buildUpgradePage', 'showToast', 'console', 'removeUpgradeItem', block)(
      d, 'collection', state, () => Promise.resolve(true), () => {}, () => {}, { warn() {} },
      (k) => { removed.push(k); delete state.upgradeData[k]; return Promise.resolve(); });
    return { state, removed };
  }
  const base = { _fromUpgradeList: true, _fromUpgradeKey: 'INV1', _fromUpgradeMateKeys: [{ num: '2343C', key: 'INV2' }, { num: '2343T-D', key: 'INV3' }] };
  let o = run(Object.assign({}, base, { _itemGrouping: 'aba', unit2ItemNum: '2343C', unit3ItemNum: '2343T' }));
  r.all3 = !o.state.upgradeData.INV1 && !o.state.upgradeData.INV2 && !o.state.upgradeData.INV3 && o.removed.sort().join() === 'INV2,INV3';
  o = run(Object.assign({}, base, { _itemGrouping: 'ab', unit2ItemNum: '2343C' }));
  r.dummyDropped = !!o.state.upgradeData.INV3 && !o.state.upgradeData.INV2;
  return r;
}

(async () => {
  section('T · the fold: an Upgrade piece belongs to its owned set');
  const T = foldChecks();
  ok('the whole 3-piece set on the Upgrade list is ONE row, lead 2343-P, 2 other pieces', T.oneRow);
  ok('…labelled "ABA SET · 3 pieces"', T.label);
  ok('…at its ONE price ($300 typed once, on every piece) — not $900', T.onePrice);
  ok('two pieces of the same owned set upgraded one at a time ($300 + $100) = one AA row, $400', T.oneByOne);
  ok('pieces of two DIFFERENT owned copies stay two rows', T.twoOwners);
  ok('a set of the collector\'s own making (nothing the catalog links) is ONE row by its owned set', T.ownOnly);
  ok('two loose copies (no set) still pair by the catalog, prices added', T.loosePair);
  ok('…and loose pieces priced the SAME are still added up ($150 + $150 = $300)', T.looseSame);
  ok('an engine kept with only its box still pairs with a loose B unit (one AB row, $400)', T.boxOnly);
  ok('an Upgrade just added from a list row (no list type yet) still shows its set price', T.untagged);
  ok('a Want-list set is unchanged (its own mark, one price)', T.wantSame);
  ok('ONE same-piece rule: 2343T-D = 2343T, 2343-P is not 2343T, 2343-D is not 2343, MTH dashes still ignored', T.pieceKey);
  section('R · Remove on the 3-piece set');
  const R = await removeChecks(SRC.pages);
  ok('asks ONCE: "Remove this set (3 pieces) from your Upgrade List?"', R.asks3);
  ok('…and clears all three rows; the other upgrade stays', R.all3);
  section('G · Got It on the 3-piece set');
  const G = gotItChecks(SRC.pages);
  ok('opens Add as the ABA set: 2343-P + 2343C + 2343T', G.aba);
  ok('…hands the save both other pieces\' keys (2343C, 2343T-D)', G.mates);
  ok('…landing on Condition & Details', G.lands);
  const S = saveChecks(SRC.save);
  ok('saved as ABA: the B unit\'s and the dummy\'s Upgrade rows come off (2343T = 2343T-D)', S.all3);
  ok('changed to AB on the way: the dummy stays on the Upgrade list', S.dummyDropped);
  const rep = APP('reports.js');
  ok('the Upgrade List report prices a set by its ONE price (_pairPrice)', /const _upv=e\._pairPrice\|\|e\.maxPrice;/.test(rep));

  section('Q · planted offenders');
  const plant = (src, a, b) => { if (src.indexOf(a) < 0) throw new Error('plant anchor missing: ' + a.slice(0, 70)); return src.replace(a, b); };
  const q1 = foldChecks(plant(SRC.app, "  return m ? m[1] : _wantOwnedGroupOf(e, invMap);", "  return m ? m[1] : '';"));
  ok('Q1 planted: no owned-set group → an own-made set splits, other owners\' pieces pair (red)', !q1.ownOnly && !q1.twoOwners);
  const q2 = foldChecks(plant(SRC.app, ".replace(/\\s+/g, '').replace(/([A-Z])-D$/, '$1').replace(/-/g, '');", ".replace(/[\\s-]/g, '');"));
  ok('Q2 planted: "2343T-D" no longer the catalog\'s "2343T" → caught (red)', !q2.pieceKey);
  const q3 = foldChecks(plant(SRC.app, "      if (/^own:/.test(gOf[i]) && /^own:/.test(gOf[j]) && gOf[i] !== gOf[j]) return;\n", ""));
  ok('Q3 planted: pieces of two different owned copies paired by the catalog → caught (red)', !q3.twoOwners);
  const q4 = foldChecks(plant(SRC.app, "      if (_same) sum = _ps[0];\n", "      if (false) sum = _ps[0];\n"));
  const q7 = foldChecks(plant(SRC.app, "      var _same = _ownSet && _ps.length > 0", "      var _same = _ps.length > 0"));
  const q8 = foldChecks(plant(SRC.app, "return /^own:/.test(gOf[i]) && gN[gOf[i]] >= 2; });", "return /^own:/.test(gOf[i]); });"));
  ok('Q4 planted: a whole set\'s price added up ($900) → caught (red)', !q4.onePrice);
  ok('Q7 planted: the one-price rule used for loose pieces too ($150 + $150 shown as $150) → caught (red)', !q7.looseSame);
  ok('Q8 planted: a box alone makes an owned set → the engine stops pairing (red)', !q8.boxOnly);
  const q5 = gotItChecks(SRC.pages.replace("var _ugPk = (typeof _wantPieceKey === 'function') ? _wantPieceKey : _wcNorm;", "var _ugPk = _wcNorm;"));
  ok('Q5 planted: Got It compares 2343T with 2343T-D by spelling → the dummy is left out (red)', !q5.aba);
  const q6 = saveChecks(plant(SRC.save, "        if (!mk || !_umSaved.some(function (x) { return _wsPieceKey(x) === _wsPieceKey(mk.num); }) || !state.upgradeData[mk.key]) return;",
    "        if (!mk || _umSaved.indexOf(String(mk.num)) < 0 || !state.upgradeData[mk.key]) return;"));
  ok('Q6 planted: the save compares by spelling → the dummy stays on the Upgrade list (red)', !q6.all3);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
