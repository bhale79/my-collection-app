#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// REPORT A PROBLEM SAYS WHICH OWNED ITEMS THE LIST COUNTS BUT DOES NOT DRAW,
// AND WHY   (2026-10-31, Lars report #26; real Chromium, the REAL app)
//
// Lars's header said 54, his list 48, and his report could not say which six or
// why. The report now carries MY COLLECTION COUNT CHECK, asked of the list
// itself (rrCollectionCountCheck → the count request, browse.js):
//   A  one copy of every kind, one filter at a time: drawn; shown inside a
//      group's lead row; shown inside a set row; hidden by Type, by the Era
//      pick, by My maker, by search, by the catalog in view (a typed-in item);
//      a box piece is never listed (not counted). Counted − Drawn always equals
//      the number listed, and nothing is UNEXPLAINED.
//   B  PLANTED a new `return false` in the row test → that copy comes out
//      UNEXPLAINED; the scan: every `return false` of the owned row test is a
//      filter the check can clear or a named rule; PLANTED an unlisted one → red
//   C  privacy: the section never carries a price, value, note, location,
//      Drive link, email — or the typed search words (only their length)
//   D  the check changes nothing: every filter is put back
//   E  the real road at iPhone size: Lars's shape on the browse.js he HAD
//      (54 counted, 48 drawn) — the preview shows 6 tick boxes; unticking one
//      leaves it out of the sent text; on today's browse.js nothing is hidden
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
try { require('playwright'); }
catch (e) { console.log('FAILED  —  report_hidden_items_tests needs playwright and it is not installed.'); process.exit(1); }
const { LARS_SIX, LARS_WORLD, OPEN_COLLECTION, bootApp, launch } = require('./lib/lars-world');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const BROWSE = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
function plant(src, from, to, what) {
  const out = src.replace(from, to);
  if (out === src) throw new Error('planted ' + what + ': the line moved; update this test');
  return out;
}
const ROW_DROP = plant(BROWSE, '    let pd = _rrPdForRow(item);\n    pd = pd || (item._personalOnly ? item : null);',
  "    let pd = _rrPdForRow(item);\n    if (pd && pd.inventoryId === '1') return false;\n    pd = pd || (item._personalOnly ? item : null);", 'row drop');
const OLD_BROWSE = plant(plant(BROWSE,
  'if (!_p && _bvSeatByRow) { var _seat = _bvSeatByRow.get(item); if (_seat) _p = _seat; }', '', 'seat'),
  '      _orphanPds.add(pd);\n', '', 'net');

// One copy of every kind (runs in the page).
const KINDS = function () {
  const PW = 'Lionel PW - Items', PRE = 'Lionel Pre-War', AT = 'Atlas O';
  const mk = (n, v, t, era, tab, id, x) => Object.assign({ itemNum: n, variation: v, itemType: t, description: t + ' ' + n, _era: era, _tab: tab, rowId: id, yearProd: era === 'prewar' ? '1930' : '1955', roadName: 'Road ' + n, gauge: 'O', varDesc: '' }, x || {});
  state.masterData = [
    mk('6464-1', '', 'Boxcar', 'pw', PW, 'R6464XXXXX'),
    mk('2343P', '1', 'Diesel Locomotive', 'pw', PW, 'R2343PXXXX'), mk('2343C', '1', 'Diesel Locomotive', 'pw', PW, 'R2343CXXXX'),
    mk('2421', '', 'Passenger Car', 'pw', PW, 'R2421XXXXX'), mk('2422', '', 'Passenger Car', 'pw', PW, 'R2422XXXXX'),
    mk('6017', '', 'Caboose', 'pw', PW, 'R6017XXXXX'),
    mk('2613', '', 'Passenger Car', 'prewar', PRE, 'R2613XXXXX'),
    mk('0326', '', 'Caboose', 'atlas', AT, 'R0326XXXXX'),
  ];
  _rebuildMasterIndex();
  state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
  let row = 3;
  const pd = (n, v, era, mfr, inv, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: mfr, inventoryId: inv, row: row++, condition: '7',
    priceItem: '125.00', userEstWorth: '999.50', notes: 'SECRET-NOTE-' + inv, location: 'SHELF-' + inv, photoItem: 'https://drive.google.com/drive/folders/SECRET' + inv, purchasedFrom: 'seller' + inv + '@example.com' }, x || {});
  state.personalData = {
    drawn: pd('6464-1', '', 'pw', 'Lionel', '1'),
    lead: pd('2343-P', '1', 'pw', 'Lionel', '2', { groupId: 'GRP-2343-1' }),
    comp: pd('2343C', '1', 'pw', 'Lionel', '3', { groupId: 'GRP-2343-1' }),
    set1: pd('2421', '', 'pw', 'Lionel', '4', { groupId: 'SET-2421-77' }),
    set2: pd('2422', '', 'pw', 'Lionel', '5', { groupId: 'SET-2421-77' }),
    cab: pd('6017', '', 'pw', 'Lionel', '6'),
    pre: pd('2613', '', 'prewar', 'Lionel', '7'),
    atlas: pd('0326', '', 'atlas', 'Atlas', '8'),
    manual: pd('MYSIGN', '', 'Manual', 'Lionel', '9', { itemType: 'Sign' }),
    box: pd('6464-1-BOX', '', 'pw', 'Lionel', '10', { hasBox: 'Yes', itemType: 'Box', groupId: '' }),
  };
  state.mySetsData = { s1: { groupId: 'SET-2421-77', setNum: '1464W' } };
  state.soldData = {}; state.wantData = {}; state.forSaleData = {}; state.isData = {};
  state.personalSheetId = 'SID';
};

(async () => {
  const browser = await launch();

  // ── A + C + D: every kind, one filter at a time ──────────────────────────
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(function () {
      (${KINDS})();
      (${OPEN_COLLECTION})({});
      const inv = l => { const p = Object.values(state.personalData).find(p => p.itemNum === l.itemNum && (p.variation || '') === l.variation); return p ? p.inventoryId : '?'; };
      const run = (label, setup) => {
        const snap = JSON.stringify(state.filters) + '|' + _currentEra + '|' + localStorage.getItem('lv_browse_filter_state');
        setup();
        const before = JSON.stringify(state.filters) + '|' + _currentEra + '|' + localStorage.getItem('lv_browse_filter_state');
        const c = rrCollectionCountCheck();
        const after = JSON.stringify(state.filters) + '|' + _currentEra + '|' + localStorage.getItem('lv_browse_filter_state');
        const out = { label, counted: c.counted, drawn: c.drawn, filters: c.filters, error: c.error,
                      lines: (c.lines || []).map(l => ({ inv: inv(l), reason: l.reason, text: l.text })), putBack: before === after };
        // reset to plain My Collection
        state.filters.type = ''; state.filters.search = ''; state.filters.ownMaker = ''; _currentEra = 'all';
        localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
        void snap;
        return out;
      };
      const chips = o => localStorage.setItem('lv_browse_filter_state', JSON.stringify(Object.assign({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }, o)));
      const S = {};
      S.plain = run('no filters', () => {});
      const tb = getTypeBucketLabel(state.masterData[0]);
      S.type = run('Type', () => { state.filters.type = tb; });
      S.era = run('Era chip', () => chips({ era: 'postwar' }));
      S.maker = run('My maker', () => { state.filters.ownMaker = 'Atlas'; });
      S.search = run('search', () => { state.filters.search = '6464'; });
      S.secret = run('search words', () => { state.filters.search = 'SECRETWORD'; });
      S.cat = run('catalog in view', () => { _currentEra = 'pw'; });
      // C — the section as the report prints it, on the most-hidden scenario
      state.filters.search = 'SECRETWORD';
      errReportOpen();
      const preview = errReportPreview();
      errReportClose();
      state.filters.search = '';
      const sec = preview.slice(preview.indexOf('MY COLLECTION COUNT CHECK'), preview.indexOf('SYNC & SIGN-IN DIARY'));
      return { S, tb, sec, hasSection: preview.indexOf('MY COLLECTION COUNT CHECK') >= 0 };
    })()`);
    const S = r.S;
    const reasonOf = (sc, inv) => (S[sc].lines.find(l => l.inv === inv) || {}).reason || '(not listed)';
    const sums = Object.keys(S).every(k => S[k].counted - S[k].drawn === S[k].lines.length);
    const unexplained = Object.keys(S).filter(k => S[k].lines.some(l => /UNEXPLAINED/.test(l.reason)));
    console.log('== A · every kind of hidden copy gets the right reason ==');
    T('A1  no filters: counted 9 (the box piece is not an item), drawn 6, three listed', S.plain.counted === 9 && S.plain.drawn === 6 && S.plain.lines.length === 3, S.plain);
    T('A2  the B-unit is "shown inside 2343-P\'s group row"', /shown inside 2343-P’s group row/.test(reasonOf('plain', '3')), reasonOf('plain', '3'));
    T('A3  both set cars are "shown inside set 1464W\'s row"', /shown inside set 1464W/.test(reasonOf('plain', '4')) && /shown inside set 1464W/.test(reasonOf('plain', '5')), [reasonOf('plain', '4'), reasonOf('plain', '5')]);
    T('A4  the box piece is never listed', !S.plain.lines.some(l => l.inv === '10'), S.plain.lines);
    T('A5  Type pick: the caboose is "hidden by: the Type pick (' + r.tb + ')"', reasonOf('type', '6') === 'hidden by: the Type pick (' + r.tb + ')', reasonOf('type', '6'));
    T('A6  Era pick (Postwar): the Pre-War 2613 is "hidden by: the Era pick (Postwar)"', reasonOf('era', '7') === 'hidden by: the Era pick (Postwar)', reasonOf('era', '7'));
    T('A7  My maker (Atlas): the Lionel boxcar is "hidden by: the My maker pick (Atlas)"', reasonOf('maker', '1') === 'hidden by: the My maker pick (Atlas)', reasonOf('maker', '1'));
    T('A8  search: the caboose is "hidden by: the search box (4 characters typed)"', reasonOf('search', '6') === 'hidden by: the search box (4 characters typed)', reasonOf('search', '6'));
    T('A9  the catalog in view (Postwar catalog): the typed-in sign is hidden by it', /^hidden by: the catalog in view .*no catalog row of its own hides under it$/.test(reasonOf('cat', '9')), reasonOf('cat', '9'));
    T('A10 the filters in force are named in the header line', S.era.filters.some(f => /Era pick \(Postwar\)/.test(f)) && S.plain.filters.length === 0, [S.era.filters, S.plain.filters]);
    T('A11 Counted − Drawn = the number listed, in every scenario', sums, Object.keys(S).map(k => [k, S[k].counted, S[k].drawn, S[k].lines.length]));
    T('A12 nothing is UNEXPLAINED in any scenario', unexplained.length === 0, unexplained.map(k => S[k].lines));
    console.log('\n== C · privacy ==');
    T('C1  the report carries the section', r.hasSection, r.sec.slice(0, 200));
    T('C2  never a price, value, note, location, Drive link or email in it', !/SECRET-NOTE|SHELF|125\.00|999\.50|drive\.google|@example\.com|seller/.test(r.sec), r.sec);
    T('C3  the typed search words are never in it — only their length', !/SECRETWORD/.test(r.sec) && /10 characters typed/.test(r.sec), r.sec);
    console.log('\n== D · the check changes nothing ==');
    T('D1  every filter is put back after the check', Object.keys(S).every(k => S[k].putBack), Object.keys(S).filter(k => !S[k].putBack));
    T('D2  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── B: the planted offender + the scan ───────────────────────────────────
  {
    const { pg, errs } = await bootApp(browser, { 'browse.js': ROW_DROP });
    const r = await pg.evaluate(`(function () { (${KINDS})(); (${OPEN_COLLECTION})({}); const c = rrCollectionCountCheck(); return c.lines.map(l => [l.itemNum, l.reason]); })()`);
    console.log('\n== B · an unnamed rule is caught ==');
    T('B1  PLANTED a new `return false` in the row test → that copy comes out UNEXPLAINED', r.some(l => l[0] === '6464-1' && /^UNEXPLAINED/.test(l[1])), r);
    T('B2  (no page errors)', errs.length === 0, errs);
    await pg.close();
  }
  // Every `return false` of the owned row test, and what accounts for it: a
  // filter the check clears (an add('<id>' in _rrCcClears), or a named rule.
  const RULES = [
    ['_ownedCandidates && !item._personalOnly', 'ownership'], ['if (isSold) ', 'rule:the sold rule'],
    ['state.filters.wantList && !isWanted', 'clear:wantList'], ['owned && !isOwned', 'ownership'],
    ['_boxish || (typeof _grpFoldActive', 'rule:the companion rule'], ["_collSec === 'trains'", 'clear:section'], ['_sr !== _collSec', 'clear:section'],
    ['unowned && (isOwned || isWanted)', 'ownership'], ['boxed && !hasBox', 'clear:boxed'], ['!_cps.some(_copyPasses)', 'copy'],
    ['!rrChipRowPasses(item, pd, _stp3b, type', 'clear:type,chipEra,chipMaker,chipScale,catalogEra'], ['road && item.roadName !== road', 'clear:road'],
    ['!_aliasSearch(haystack, search)', 'clear:search'],
    ['if (!pd) ', 'ownership'], ["boxed && pd.hasBox !== 'Yes'", 'clear:boxed'], ["_qf === 'quick'", 'clear:quickEntry'], ["_qf === 'complete'", 'clear:quickEntry'],
    ["state.filters.imported === 'imported'", 'clear:imported'], ['state.filters.ownMaker && !rrCopyMakerIs', 'clear:ownMaker'],
    ['state.filters.subCollection).trim()', 'clear:subCollection'], ['state.filters.subType).trim()', 'clear:subType'], ['if (!_nd) ', 'clear:needsDetails'],
    ['state.filters.group && typeof _ownedGroupOf', 'clear:group'],
  ];
  const scan = src => {
    const grab = (a, b) => { const i = src.indexOf(a); return i < 0 ? '' : src.slice(i, src.indexOf(b, i)); };
    const body = grab('const _rowPasses = item => {', '\n  };\n') + '\n' + grab('function _copyPasses(pd) {', '\n  }\n');
    const cc = grab('function _rrCcClears() {', '\nfunction rrCollectionCountCheck') + grab('function rrCollectionCountCheck() {', '\nif (typeof window');
    const bad = [];
    body.split('\n').filter(l => /return false/.test(l)).forEach(l => {
      // one line may hold two (`if (!isOwned) { if (boxed …) return false; if (imported) return false; }`)
      l.split(/return false/).slice(0, -1).forEach((piece, k, all) => {
        const r = RULES.find(x => piece.indexOf(x[0]) >= 0 || (k > 0 && all[k].indexOf(x[0]) >= 0));
        if (!r) { bad.push(l.trim().slice(0, 140)); return; }
        const how = r[1];
        if (how.startsWith('clear:') && !how.slice(6).split(',').every(id => cc.indexOf("add('" + id + "'") >= 0)) bad.push('no clear for ' + how + ': ' + l.trim().slice(0, 80));
        if (how.startsWith('rule:') && cc.indexOf(how.slice(5)) < 0) bad.push('no named rule ' + how + ': ' + l.trim().slice(0, 80));
      });
    });
    return { bad, n: body.split('\n').filter(l => /return false/.test(l)).length };
  };
  const s0 = scan(BROWSE);
  T('B3  every `return false` in the owned row test is a filter the check clears or a named rule (' + s0.n + ' lines)', s0.bad.length === 0 && s0.n >= 20, s0.bad);
  const s1 = scan(ROW_DROP);
  T('B4  PLANTED an unlisted `return false` → the scan goes red', s1.bad.length === 1, s1.bad);
  const s2 = scan(BROWSE.replace("add('search',", "add('srch',"));
  T('B5  PLANTED a filter the check can no longer clear → the scan goes red', s2.bad.length === 1 && /search/.test(s2.bad[0]), s2.bad);

  // ── E: the real road at iPhone size ──────────────────────────────────────
  {
    const six = JSON.stringify(LARS_SIX);
    const { pg, errs } = await bootApp(browser, { 'browse.js': OLD_BROWSE }, { width: 390, height: 844 });
    const r = await pg.evaluate(`(function () {
      (${LARS_WORLD})({ six: ${six} });
      (${OPEN_COLLECTION})({});
      errReportOpen();
      const boxes = Array.from(document.querySelectorAll('[id^="err-cc-"]'));
      const full = errReportPreview();
      boxes[0].checked = false;
      const cut = errReportPreview();
      errReportClose();
      const sec = t => t.slice(t.indexOf('MY COLLECTION COUNT CHECK'), t.indexOf('SYNC & SIGN-IN DIARY'));
      return { n: boxes.length, full: sec(full), cut: sec(cut) };
    })()`);
    console.log('\n== E · the real road (iPhone size) ==');
    T('E1  Lars\'s shape on the browse.js he had: "Counted: 54   Drawn now: 48"', /Counted: 54 {3}Drawn now: 48/.test(r.full), r.full.slice(0, 200));
    T('E2  the preview shows 6 tick boxes', r.n === 6, r.n);
    T('E3  …each of his six named, UNEXPLAINED (the real bug job A fixed)', LARS_SIX.every(s => new RegExp('\\n    ' + s.num + ' +var ' + s.v + ' .*UNEXPLAINED').test(r.full)), r.full);
    T('E4  unticking one leaves it out of the sent text', (r.cut.match(/UNEXPLAINED/g) || []).length === 5 && /1 left out by the sender/.test(r.cut), r.cut);
    T('E5  no page errors', errs.length === 0, errs);
    await pg.close();
    const { pg: pg2, errs: e2 } = await bootApp(browser, null, { width: 390, height: 844 });
    const r2 = await pg2.evaluate(`(function () { (${LARS_WORLD})({ six: ${six} }); (${OPEN_COLLECTION})({}); errReportOpen(); const t = errReportPreview(); errReportClose();
      return t.slice(t.indexOf('MY COLLECTION COUNT CHECK'), t.indexOf('SYNC & SIGN-IN DIARY')); })()`);
    T('E6  on today\'s browse.js: 54 counted, 54 drawn, "Every counted item is drawn."', /Counted: 54 {3}Drawn now: 54/.test(r2) && /Every counted item is drawn\./.test(r2), r2);
    T('E7  no page errors', e2.length === 0, e2);
    await pg2.close();
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
