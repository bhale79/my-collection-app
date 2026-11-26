// ═══════════════════════════════════════════════════════════════════════════
// want_sets_tests.js — 2026-11-25 (wantsets, PLAN_2026-11-25_WANT_SETS_ONE_ROW.md)
//
// [stated] Brad 2026-11-25 11:39 CT: "we need to fix this in the want list. it
// should just be one row like the my collection correct?" → "One row" → 12:01
// CT "okay to start".
//
// What was wrong (live main 31ca8c76): a 2343 added to the Want list as an AA
// set is saved as two rows (2343-P + 2343T, one group, the pair's price on
// each). The Want / Upgrade page had its own fold that never folded the second
// A, so it drew two rows at $350 each and said "4 items" while the menu said 3;
// the gift list did not fold at all; the one fold that did (foldWantEntries)
// read the group only from the notes, so a just-saved pair cost $700 on the
// Dashboard; Got It and Remove left the second piece behind.
//
// These run the REAL functions (app.js, app-pages.js, wizard-save.js,
// gift-list.js) lifted out of the source, on a Lionel 2343 family. Section G
// plants the old shapes back, one at a time, and each must go red.
//
// Run: node tests/want_sets_tests.js
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
  'getADummyPartner', 'getSetPartner', 'normalizeItemNum', 'baseItemNum', '_wantGroupOf', '_wantIsCompanion', 'foldWantEntries', 'wantSetLabel'];
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

// The cases every fold check runs on.
const JUST_SAVED = () => [   // what the want save leaves in state (clean notes, group in .groupId)
  { itemNum: '2343-P', variation: '', expectedPrice: '350', notes: '', groupId: 'grp-aa1', row: 11, listType: 'Want' },
  { itemNum: '2343T', variation: '', expectedPrice: '350', notes: '', groupId: 'grp-aa1', row: 12, listType: 'Want' },
  { itemNum: '6464-100', variation: '1', expectedPrice: '200', notes: '', row: 13, listType: 'Want' }];
const LOADED = () => [       // the same set after a reload (the group as a mark in the notes), companion listed FIRST
  { itemNum: '2343T', variation: '', expectedPrice: '350', notes: '[grp:grp-aa1] for the layout', row: 12 },
  { itemNum: '2343-P', variation: '', expectedPrice: '350', notes: '[grp:grp-aa1] for the layout', row: 11 }];
const ODD_GROUP = () => [    // saved together, numbers the catalog does not pair
  { itemNum: '9999', variation: '', expectedPrice: '80', groupId: 'grp-odd' }, { itemNum: '9999X', variation: '', expectedPrice: '80', groupId: 'grp-odd' }];
const SEPARATE = () => [     // added one at a time, no group — the catalog pairs them, prices add up
  { itemNum: '2343-P', variation: '', expectedPrice: '200' }, { itemNum: '2343T', variation: '', expectedPrice: '150' }];
const TWO_COPIES = () => [   // two rows with one number are two rows
  { itemNum: '2343-P', variation: '1', expectedPrice: '100' }, { itemNum: '2343T', variation: '1', expectedPrice: '50' }, { itemNum: '2343T', variation: '2', expectedPrice: '60' }];

function foldChecks(appSrc) {
  const W = foldWorld(appSrc), r = {};
  let f = W.foldWantEntries(JUST_SAVED());
  const aa = f.find(e => e.itemNum === '2343-P') || {};
  r.justSavedOneRow = f.length === 2 && (aa._wantMates || []).join() === '2343T';
  r.justSavedOnePrice = aa._pairPrice === '350';
  r.mateRows = (aa._mateRows || []).length === 1 && aa._mateRows[0].row === 12;
  r.label = W.wantSetLabel(aa) === 'AA SET · 2 pieces' && aa._groupCfg === 'AA';
  f = W.foldWantEntries(LOADED());
  r.loadedLead = f.length === 1 && f[0].itemNum === '2343-P' && f[0]._pairPrice === '350';
  f = W.foldWantEntries(ODD_GROUP());
  r.oddGroup = f.length === 1 && (f[0]._wantMates || []).join() === '9999X' && f[0]._pairPrice === '80';
  f = W.foldWantEntries(SEPARATE());
  r.separateSum = f.length === 1 && f[0]._pairPrice === '350' && f[0]._pairIsGroup === false;
  f = W.foldWantEntries(TWO_COPIES());
  r.twoCopies = f.length === 2 && f.filter(e => e.itemNum === '2343T').length === 1;
  r.single = W.foldWantEntries([{ itemNum: '6464-100', variation: '1', expectedPrice: '200' }])[0]._wantMates === undefined;
  return r;
}

section('A · THE fold (app.js foldWantEntries) — a set is one row with one price');
const A = foldChecks(SRC.app);
ok('a just-saved AA set (group in .groupId, clean notes) is ONE row: 2343-P with 2343T folded in', A.justSavedOneRow);
ok('…with ONE price — $350, not $700 (the Dashboard/Reports bug before a reload)', A.justSavedOnePrice);
ok('…and the folded row carries the other piece\'s own entry (its sheet row) for Got It / Remove', A.mateRows);
ok('…and the tag reads like My Collection: "AA SET · 2 pieces"', A.label);
ok('the same set after a reload (group as a [grp:] mark, the second A listed first) — 2343-P leads, one price', A.loadedLead);
ok('pieces saved together fold by their group even when the catalog does not pair their numbers', A.oddGroup);
ok('pieces added separately (no group) still fold by the catalog, and their prices add up ($200 + $150)', A.separateSum);
ok('two rows with one number stay two rows — the second 2343T is not swallowed', A.twoCopies);
ok('a single item is untouched', A.single);

// ── B · the Want / Upgrade page ─────────────────────────────────────────────
function pageFold(pagesSrc, appSrc) {
  // the page's _wuFoldPairs, as written inside buildUpgradePage, run with THE fold
  const body = grab(pagesSrc, 'buildUpgradePage');
  const inner = grab(body, '_wuFoldPairs');
  const W = foldWorld(appSrc);
  return new Function('foldWantEntries', 'getSetPartner', 'getMatchingTenders', 'isLocomotive', 'getADummyPartner', inner + '\nreturn _wuFoldPairs;')(
    W.foldWantEntries, W.getSetPartner, W.getMatchingTenders, W.isLocomotive, W.getADummyPartner);
}
function pageChecks(pagesSrc, appSrc) {
  const r = {};
  const fp = pageFold(pagesSrc, appSrc);
  const ups = [{ itemNum: '2343T', variation: '', maxPrice: '90', listType: 'Upgrade', inventoryId: '77' }];
  const rows = fp(JUST_SAVED().concat(ups).map(e => Object.assign({}, e)));
  const aa = rows.find(e => e.itemNum === '2343-P') || {};
  r.oneRow = rows.filter(e => e.listType === 'Want').length === 2 && (aa._wantMates || []).join() === '2343T';
  r.wantNotIntoUpgrade = rows.filter(e => e.listType === 'Upgrade').length === 1;
  r.orderKept = rows.map(e => e.itemNum).join() === '2343-P,6464-100,2343T';
  // the price cell and the number cell
  const W = foldWorld(appSrc);
  const ctx = new Function('wantSetLabel', 'rrEsc', grab(pagesSrc, '_wuPriceOf') + '\n' + grab(pagesSrc, '_wuItemNumHTML') + '\nreturn { _wuPriceOf, _wuItemNumHTML };')(
    W.wantSetLabel, s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const sep = W.foldWantEntries(SEPARATE())[0];
  r.price = ctx._wuPriceOf(aa, true) === '350' && ctx._wuPriceOf(sep, true) === '350' && ctx._wuPriceOf({ expectedPrice: '20' }, true) === '20' && ctx._wuPriceOf({ maxPrice: '30' }, false) === '30';
  r.tag = /2343-P<br><span class="wu-set-tag"[^>]*>🔗 AA SET · 2 pieces<\/span>/.test(ctx._wuItemNumHTML(aa)) && ctx._wuItemNumHTML({ itemNum: '6520' }) === '6520';
  // both layouts use the one price; the count is folded the same way as the rows
  const b = grab(pagesSrc, 'buildUpgradePage');
  r.bothLayouts = (b.match(/_priceVal = _wuPriceOf\(u, _isWant\)/g) || []).length === 2 && !/_priceVal = _isWant \? u\.expectedPrice/.test(b);
  r.noOwnFold = !/getSetPartner|getMatchingTenders|_mergedTender/.test(b);
  // Remove on a set hands its pieces in
  r.menuMates = /removeWantItem\(u\.itemNum, u\.variation \|\| '', u\.row, u\._mateRows\)/.test(grab(pagesSrc, '_wuMenu'));
  return r;
}
section('B · the Want / Upgrade page draws a set as one row');
const B = pageChecks(SRC.pages, SRC.app);
ok('the page folds with THE fold: the AA set is one Want row (2343-P + 2343T)', B.oneRow);
ok('a want never folds into an upgrade (the upgrade 2343T stays its own row)', B.wantNotIntoUpgrade);
ok('the sorted order is kept', B.orderKept);
ok('the price shown is the set\'s ONE price (group price, or separate pieces added up); single rows unchanged', B.price);
ok('the number cell carries My Collection\'s tag "🔗 AA SET · 2 pieces"; a single number is plain', B.tag);
ok('the table AND the phone cards both use the one price', B.bothLayouts);
ok('buildUpgradePage has no partner logic of its own (no getSetPartner / getMatchingTenders / _mergedTender)', B.noOwnFold);
ok('Remove on a set row hands its other pieces to removeWantItem', B.menuMates);

// ── C · Remove clears every piece ───────────────────────────────────────────
async function removeChecks(pagesSrc) {
  const r = {};
  async function run(args, refuse) {
    const state = { personalSheetId: 'S', wantData: { '2343-P|': { itemNum: '2343-P', row: 11 }, '2343T|': { itemNum: '2343T', row: 12 }, '6520|': { itemNum: '6520', row: 14 } } };
    const log = { asked: '', rows: [] };
    const fn = new Function('state', 'appConfirm', 'rrVerifiedRowUpdate', '_cachePersonalData', 'buildWantPage', 'buildUpgradePage', 'buildDashboard', 'showToast',
      grab(pagesSrc, 'removeWantItem', 'async function ') + '\nreturn removeWantItem;')(
      state, async q => { log.asked = q; return true; }, async (sh, tab, row) => { log.rows.push(row); return !(refuse && refuse.indexOf(row) >= 0); },
      () => {}, () => {}, () => {}, () => {}, () => {});
    await fn.apply(null, args);
    return { state, log };
  }
  let o = await run(['2343-P', '', 11, [{ itemNum: '2343T', variation: '', row: 12 }]]);
  r.setAsk = /Remove this set \(2 pieces\)/.test(o.log.asked);
  r.setGone = !o.state.wantData['2343-P|'] && !o.state.wantData['2343T|'] && !!o.state.wantData['6520|'] && o.log.rows.join() === '11,12';
  o = await run(['6520', '', 14]);
  r.single = /Remove this item/.test(o.log.asked) && !o.state.wantData['6520|'] && o.log.rows.join() === '14';
  o = await run(['2343-P', '', 11, [{ itemNum: '2343T', variation: '', row: 12 }]], [11]);
  r.leadRefused = !!o.state.wantData['2343-P|'] && !!o.state.wantData['2343T|'];
  return r;
}

// ── D · Got It takes every piece off ────────────────────────────────────────
function gotItChecks(saveSrc, pagesSrc, wizSrc) {
  const r = {};
  const a = saveSrc.indexOf('// ── If this came from the Want List, clean up the want entry ──');
  const b = saveSrc.indexOf('// ── If this came from the Upgrade List', a);
  const block = saveSrc.slice(a, b);
  function run(d) {
    const state = { personalSheetId: 'S', wantData: { '2343-P|': { itemNum: '2343-P', row: 11 }, '2343T|': { itemNum: '2343T', row: 12 }, '6520|': { itemNum: '6520', row: 14 } } };
    const rows = [];
    new Function('d', 'tab', 'state', 'rrVerifiedRowUpdate', 'buildWantPage', 'showToast', 'console', block)(
      d, 'collection', state, (sh, t, row) => { rows.push(row); return Promise.resolve(true); }, () => {}, () => {}, { warn() {} });
    return { state, rows };
  }
  const base = { _fromWantList: true, _fromWantKey: '2343-P|', _fromWantMateKeys: [{ num: '2343T', key: '2343T|' }] };
  let o = run(Object.assign({}, base, { _itemGrouping: 'aa', unit2ItemNum: '2343T' }));
  r.bothGone = !o.state.wantData['2343-P|'] && !o.state.wantData['2343T|'] && !!o.state.wantData['6520|'] && o.rows.join() === '11,12';
  o = run(Object.assign({}, base, { _itemGrouping: 'single', unit2ItemNum: '' }));
  r.changedToSingle = !o.state.wantData['2343-P|'] && !!o.state.wantData['2343T|'];
  o = run(Object.assign({}, base, { _itemGrouping: 'aa', unit2ItemNum: '2343X' }));
  r.otherPartner = !!o.state.wantData['2343T|'];
  // moveWantToCollection hands the partners' want keys to the save
  const mw = grab(pagesSrc, 'moveWantToCollection');
  r.handsKeys = /wizard\.data\._fromWantMateKeys = \[_wcTender, _wcBunit, _wcDummy\]/.test(mw);
  r.notOnReview = /'_fromWantMateKeys'/.test(wizSrc);
  return r;
}

// ── E · the gift list: one line per set ─────────────────────────────────────
function giftChecks(giftSrc, appSrc) {
  const r = {};
  const W = foldWorld(appSrc);
  const state = { wantData: {} };
  JUST_SAVED().forEach(e => { state.wantData[e.itemNum + '|' + e.variation] = e; });
  const names = ['_key', '_wants', '_master', '_words', '_setWords', '_name', '_rowFor', '_searchUrl'];
  const G = new Function('state', 'foldWantEntries', 'findMaster', 'baseItemNum', '_G', 'window',
    'var _rows = {};\n' + names.map(n => grab(giftSrc, n)).join('\n') + '\nreturn { ' + names.join(', ') + ', _rows: _rows };')(
    state, W.foldWantEntries, n => (/^2343/.test(n) ? { roadName: 'Santa Fe', description: 'F3 Diesel' } : { roadName: 'Western Pacific', description: 'Boxcar' }),
    W.baseItemNum, () => ({ storeSearch: { 'trainz.com': 'https://www.trainz.com/search?q={q}' } }), {});
  const list = G._wants();
  const set = list.find(e => e.itemNum === '2343-P') || {};
  r.oneLine = list.length === 2 && !list.some(e => e.itemNum === '2343T');
  r.name = G._name(Object.assign({ manufacturer: 'Lionel' }, set), true) === 'Lionel 2343-P + 2343T (AA set) — Santa Fe F3 Diesel';
  r.single = G._name({ manufacturer: 'Lionel', itemNum: '6464-100', variation: '1' }, true) === 'Lionel 6464-100 — Western Pacific Boxcar';
  r.price = G._rowFor(set).price === '350';
  r.search = G._searchUrl(Object.assign({ manufacturer: 'Lionel' }, set), { site: 'trainz.com' }) === 'https://www.trainz.com/search?q=Lionel%202343'
    && G._searchUrl({ manufacturer: 'Lionel', itemNum: '2245-P' }, { site: 'trainz.com' }) === 'https://www.trainz.com/search?q=Lionel%202245P';
  return r;
}

(async () => {
  section('C · Remove on a set clears every piece');
  const C = await removeChecks(SRC.pages);
  ok('a set is asked about ONCE, as a set: "Remove this set (2 pieces)…"', C.setAsk);
  ok('…and both pieces\' rows are cleared (rows 11 and 12); other wants untouched', C.setGone);
  ok('a single want is asked and cleared as before', C.single);
  ok('if the sheet refuses the lead\'s row, nothing is taken off', C.leadRefused);

  section('D · Got It on a set takes every piece off the Want list');
  const D = gotItChecks(SRC.save, SRC.pages, SRC.wiz);
  ok('Got It on the AA set (the walk saved 2343T with it): both want rows cleared', D.bothGone);
  ok('changed to one piece on the way: only the lead comes off, 2343T stays wanted', D.changedToSingle);
  ok('a different partner saved: the wanted 2343T stays', D.otherPartner);
  ok('moveWantToCollection hands the partners\' want keys to the save', D.handsKeys);
  ok('…and the key is an internal flag (never a review row)', D.notOnReview);

  section('E · the gift list shows a set once');
  const E = giftChecks(SRC.gift, SRC.app);
  ok('the AA set is ONE gift-list line (no 2343T line of its own)', E.oneLine);
  ok('it is named with both pieces: "Lionel 2343-P + 2343T (AA set) — Santa Fe F3 Diesel"', E.name);
  ok('a single item\'s name is unchanged', E.single);
  ok('its price starts at the set\'s one price ($350)', E.price);
  ok('Find it at Trainz searches the plain number ("Lionel 2343"); a single unit keeps its own ("2245P")', E.search);

  section('F · every list uses THE fold');
  const dash = APP('dashboard.js'), rep = APP('reports.js'), show = APP('show-mode.js');
  ok('menu count, Dashboard, Reports and show mode all call foldWantEntries', /foldWantEntries\(Object\.values\(state\.wantData/.test(SRC.app) && /foldWantEntries/.test(dash) && /foldWantEntries/.test(rep) && /foldWantEntries/.test(show));
  ok('the gift list folds with it', /list = foldWantEntries\(list\)/.test(grab(SRC.gift, '_wants')));

  // ── G · planted offenders — the old shapes, each must go red ──────────────
  section('G · planted offenders');
  const plant = (src, a, b) => { if (src.indexOf(a) < 0) throw new Error('plant anchor missing: ' + a.slice(0, 60)); return src.replace(a, b); };
  // G1: the group read from the notes only (the $700 Dashboard bug)
  const g1 = foldChecks(plant(SRC.app, "  if (e.groupId) return String(e.groupId);\n", ''));
  ok('G1 planted: the group read only from the notes → the just-saved set is caught (red)', !g1.justSavedOnePrice || !g1.justSavedOneRow);
  // G2: no "saved together" step
  const a2 = SRC.app.indexOf('  // 1. saved together'), b2 = SRC.app.indexOf('  // 2. added separately');
  const g2 = foldChecks(SRC.app.slice(0, a2) + SRC.app.slice(b2));
  ok('G2 planted: no group step → the odd-numbered set is two rows (red)', !g2.oddGroup);
  // G3: the page's old fold put back (no second A)
  const oldFold = `function _wuFoldPairs(entries) {
    var byNum = {};
    entries.forEach(function(e) { if (!byNum[e.itemNum]) byNum[e.itemNum] = e; });
    var absorbed = {};
    entries.forEach(function(e) {
      if (absorbed[e.itemNum]) return;
      if (!e._mergedTender && typeof getSetPartner === 'function') {
        var _b = String(e.itemNum).replace(/-(P|D)$/i, '');
        if (!/C$/i.test(_b)) {
          var _sp = getSetPartner(e.itemNum);
          if (_sp && String(_sp) !== String(e.itemNum) && byNum[_sp] && !absorbed[_sp] && byNum[_sp].listType === e.listType) {
            e._mergedTender = String(_sp); absorbed[_sp] = true;
          }
        }
      }
    });
    if (Object.keys(absorbed).length) entries = entries.filter(function(e) { return !absorbed[e.itemNum]; });
    return entries;
  }`;
  const fpBody = grab(grab(SRC.pages, 'buildUpgradePage'), '_wuFoldPairs');
  const g3 = pageChecks(SRC.pages.replace(fpBody, oldFold), SRC.app);
  ok('G3 planted: the page\'s own old fold → the AA set is two rows again (red)', !g3.oneRow && !g3.noOwnFold);
  // G4: the price cell back to the lead's own price
  const g4 = pageChecks(plant(SRC.pages, '  if (u && u._wantMates && u._pairPrice) return u._pairPrice;\n', ''), SRC.app);
  ok('G4 planted: the price ignores the set → separately-added pieces show $200, not $350 (red)', !g4.price);
  // G5: Remove ignores the other pieces
  const g5 = await removeChecks(plant(SRC.pages, "const _set = (Array.isArray(mates) ? mates : [])", "const _set = ([])"));
  ok('G5 planted: Remove clears only the lead → 2343T is left behind (red)', !g5.setGone);
  // G6: Got It's cleanup without the pieces
  const g6 = gotItChecks(plant(SRC.save, "if ((d._itemGrouping || 'single') !== 'single') (d._fromWantMateKeys || [])", "if (false) (d._fromWantMateKeys || [])"), SRC.pages, SRC.wiz);
  ok('G6 planted: Got It clears only the lead → 2343T is left behind (red)', !g6.bothGone);
  // G7: the gift list unfolded
  const g7 = giftChecks(plant(SRC.gift, '    if (typeof foldWantEntries === \'function\') list = foldWantEntries(list);\n', ''), SRC.app);
  ok('G7 planted: the gift list without the fold → a line per piece (red)', !g7.oneLine);
  // G8: the gift search on the powered unit
  const g8 = giftChecks(plant(SRC.gift, "      if (e._wantMates && e._wantMates.length) num =", "      if (false) num ="), SRC.app);
  ok('G8 planted: the set searched as "2343P" → caught (red)', !g8.search);
  // G9: the menu forgets the pieces
  const g9 = pageChecks(plant(SRC.pages, "removeWantItem(u.itemNum, u.variation || '', u.row, u._mateRows)", "removeWantItem(u.itemNum, u.variation || '', u.row)"), SRC.app);
  ok('G9 planted: the ⋯ Remove forgets the pieces → caught (red)', !g9.menuMates);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
