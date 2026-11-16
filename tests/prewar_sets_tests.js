#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════
// LIONEL PRE-WAR SETS — A SET LIST PER ERA — 2026-11-15 (prewarsets)
// (Node + jsdom, the REAL app code)
//
// [stated] Brad 2026-11-15 09:42 CT: "lets get these into the master and get
// the app where it can read them" → 09:52 CT "yes the plan is good, do both
// parts". A collector entering Pre-War sets by hand found no Pre-War set in
// the catalog: the only set list was "Lionel PW - Sets". Master Version 2.97
// adds the tab "Lionel Pre-War - Sets" (same 21 columns); this release reads it.
//
// The danger is the one that keeps biting: NUMBERS REPEAT. 1611 is a Postwar
// set AND a 1932 Ives transition set; Pre-War 252 is an electric engine,
// Postwar 252 a crossing gate. So a set row SAYS its era and every reader asks
// the row. The stand-in set list has 1611 on BOTH lists.
//   A  config: Pre-War has a Sets tab; the eras with a set list; the two lines
//      name the set's own catalog; no "AI"
//   B  rows are tagged with their era when parsed; a row that does not say is
//      Postwar's (every saved copy before this release); a tag is never overwritten
//   C  rrSetFind narrows by era, then year, then the era on screen;
//      rrPostwarSets / rrSetsOnView keep each list to its own view
//   D  the one loader brings in EVERY missing set list beside the ones already
//      in — asks for the Pre-War tab by name, keeps Postwar's rows, tags the
//      new ones; a failed read counts as tried and loses nothing
//   E  the item box: a Pre-War set is a Lionel · Pre-War row; 1611 gives TWO
//      set rows, one per era; a set's pieces are looked up in the set's era
//   F  saving: a Pre-War set's pieces are saved as Pre-War whatever era is on
//      screen; a Postwar set's keep the word they always had; an own set is
//      not touched by any of it
//   S  scans, each with a planted offender: the partner map, the Set Builder
//      and the Postwar book's set fixes read Postwar's list only; no piece
//      lookup or save names Postwar by hand
// ═════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { console.log('FAILED  —  prewar_sets_tests needs jsdom (npm install --no-save jsdom).'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function grab(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('missing ' + head);
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + head);
}
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}

const CFG = read('config.js'), DATA = read('app-data.js'), SUG = read('wizard-suggestions.js'), WIZ = read('wizard.js');
const SAVE = read('wizard-save.js'), APPJS = read('app.js'), TOOLS = read('tools.js'), DRIVE = read('drive.js');

const HELPERS = ['function rrSetEra(', 'function rrSetsTagEra(', 'function rrSetsOfEra(', 'function rrPostwarSets(', 'function rrSetsOnView(',
  'function rrSetEraIds(', 'function rrSetFind(', 'function parseSetRows(', 'function rrEnsurePostwarSets(', 'function rrSetListsPending('];

function world(dataSrc, sugSrc, saveSrc) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const win = dom.window;
  win.console = { log() {}, warn() {}, error() {} };
  const code = [
    CFG,
    'var state = { masterData: [], setData: [], personalData: {}, masterSheetId: "M" }; var _currentEra = "all"; var wizard = { data: {}, matchedItem: null };',
    'var _rrPwSetsPromise = null, _rrPwSetsTried = false;',
    'var CALLS = []; var SHEET = {}; function sheetsGet(id, range) { CALLS.push(range); var t = String(range).split("!")[0]; if (SHEET[t] === "FAIL") return Promise.reject(new Error("no")); return Promise.resolve({ values: SHEET[t] || [] }); }',
    'var ASKED = []; function findMaster(n, v, prefer) { ASKED.push({ n: n, era: prefer && prefer.era }); return { itemNum: n, _era: prefer && prefer.era, roadName: "ROAD" + (prefer && prefer.era), description: "", itemType: "", subType: "" }; }',
    'function rrNumSameAsTyped(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }',
    HELPERS.map(function (h) { return grab(dataSrc, h); }).join('\n'),
    'var _rrSetPieceCache = { sig: "", map: null };',
    grab(sugSrc, 'function _rrSetCfg('), grab(sugSrc, 'function _rrSetNorm('), grab(sugSrc, 'function _rrSetPieceWords('),
    grab(sugSrc, 'function rrSetAsRow('), grab(sugSrc, 'function _wizPostwarSetHits('),
    grab(sugSrc, 'function _wizSetTabsOf('), grab(sugSrc, 'function _wizSetCopyRow('), grab(sugSrc, 'function _wizSetBoxRow('),
    grab(saveSrc, 'function _rrAddNoRowItem('),   // 2026-11-15 (unknownnum): _resolveSaveEra asks it first
    grab(saveSrc, 'function _resolveSaveEra('), grab(saveSrc, 'function rrSetSaveEra('),
    'this.__ = { state: function () { return state; }, era: function (e) { _currentEra = e; }, wiz: function (w) { wizard = w; }, calls: function () { return CALLS; }, sheet: function (t, v) { SHEET[t] = v; },'
      + ' asked: function () { return ASKED; }, reset: function () { CALLS.length = 0; ASKED.length = 0; _rrPwSetsPromise = null; _rrPwSetsTried = false; SHEET = {}; state.setData = []; _currentEra = "all"; },'
      + ' tabs: function () { return ERA_TABS; }, words: function () { return RR_ADD_FILTERS; } };',
  ].join('\n;\n');
  win.eval(code);
  return win;
}

const PW = [
  { _era: 'pw', setNum: '1611', setName: 'Alaska Freight', year: '1959', gauge: 'O27', items: ['614', '6162', '6825', '6465', '6027'], alts: [] },
  { _era: 'pw', setNum: '1467W', setName: 'Erie Freight', year: '1952', gauge: 'O27', items: ['2032', '2032C', '6656'], alts: [] },
];
const PRE = [
  { _era: 'prewar', setNum: '1611', setName: 'Ives transition passenger set', year: '1932', gauge: 'O', items: ['1651', '1690', '1690', '1691'], alts: [] },
  { _era: 'prewar', setNum: '191W', setName: 'Freight outfit', year: '', gauge: 'O', items: ['226E', '2226W', '2815', '2816', '2817'], alts: [] },
];
const clone = (a) => JSON.parse(JSON.stringify(a));
const ROW = (num, name) => { const r = new Array(21).fill(''); r[0] = num; r[1] = name; r[2] = '1930'; r[3] = 'O'; r[5] = '258'; r[6] = '257T'; r[10] = '529'; return r; };

(async function () {
  let W;
  try { W = world(DATA, SUG, SAVE); }
  catch (e) { ok('the harness loads the real code', false, e.stack); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }
  const X = W.__;

  // ── A: config ──
  const tabs = X.tabs(), words = X.words();
  ok('A1 Pre-War has a Sets tab, named as the master names it', tabs.prewar.sets === 'Lionel Pre-War - Sets', tabs.prewar.sets);
  ok('A2 Postwar\'s Sets tab is untouched', tabs.pw.sets === 'Lionel PW - Sets', tabs.pw.sets);
  const ids = W.rrSetEraIds();
  ok('A3 the eras with a set list are Pre-War and Postwar — no other', ids.length === 2 && ids.indexOf('pw') >= 0 && ids.indexOf('prewar') >= 0, ids.join(','));
  ok('A4 "is a set?" names the Pre-War catalog for a Pre-War set', W.rrSetLine('setAsk', '191W', 'prewar') === '191W is a Lionel Pre-War set — add it as a set?', W.rrSetLine('setAsk', '191W', 'prewar'));
  ok('A5 …and reads as it always did for a Postwar set', W.rrSetLine('setAsk', '1467W', 'pw') === '1467W is a Lionel Postwar set — add it as a set?', W.rrSetLine('setAsk', '1467W', 'pw'));
  ok('A6 the green line: Postwar unchanged, Pre-War named', W.rrSetLine('setFound', '1467W', 'pw') === 'Lionel Postwar set 1467W' && W.rrSetLine('setFound', '191W', 'prewar') === 'Lionel Pre-War set 191W');
  ok('A7 an era with no words of its own falls back to Postwar\'s, never a blank', W.rrSetLine('setFound', '9', 'zz') === 'Lionel Postwar set 9');
  ok('A8 no line says "AI"', !/\bAI\b/.test([words.setAsk, words.setFound, JSON.stringify(words.setEraWords)].join(' ')));

  // ── B: rows say their era ──
  X.reset();
  W.parseSetRows([ROW('234', 'Passenger outfit')], 'prewar');
  ok('B1 a parsed row carries the era it was read for', X.state().setData.length === 1 && X.state().setData[0]._era === 'prewar', JSON.stringify(X.state().setData[0]));
  ok('B2 …and its pieces, in order', X.state().setData[0].items.join(',') === '258,257T,529', X.state().setData[0].items.join(','));
  X.reset(); X.era('pw');
  W.parseSetRows([ROW('1400', 'Passenger')]);
  ok('B3 no era named → the era on screen', X.state().setData[0]._era === 'pw');
  ok('B4 a row that does not say is Postwar\'s', W.rrSetEra({ setNum: '1' }) === 'pw' && W.rrSetEra(null) === 'pw');
  const t = W.rrSetsTagEra([{ setNum: 'a' }, { setNum: 'b', _era: 'prewar' }], 'pw');
  ok('B5 tagging fills a blank and never overwrites', t[0]._era === 'pw' && t[1]._era === 'prewar');
  ok('B6 "all" is not an era a row can be tagged with', W.rrSetsTagEra([{ setNum: 'a' }], 'all')[0]._era === undefined);

  // ── C: find and views ──
  X.reset(); X.state().setData = clone(PW).concat(clone(PRE));
  ok('C1 1611 asked as Pre-War is the Ives set', W.rrSetFind('1611', { era: 'prewar' }).year === '1932');
  ok('C2 1611 asked as Postwar is the Postwar set', W.rrSetFind('1611', { era: 'pw' }).year === '1959');
  ok('C3 the year narrows when the era is not known', W.rrSetFind('1611', { year: '1932' })._era === 'prewar');
  X.era('prewar');
  ok('C4 no hint: the era on screen decides', W.rrSetFind('1611')._era === 'prewar');
  X.era('pw');
  ok('C5 …in Postwar it is Postwar\'s', W.rrSetFind('1611')._era === 'pw');
  ok('C6 a number on one list only is found from any view', W.rrSetFind('191W')._era === 'prewar' && W.rrSetFind('nope') === null);
  ok('C7 the Postwar-only readers see Postwar\'s sets and nothing else', W.rrPostwarSets().length === 2 && W.rrPostwarSets().every(s => s._era === 'pw'));
  ok('C8 a Postwar view lists Postwar\'s sets', W.rrSetsOnView().length === 2 && W.rrSetsOnView().every(s => s._era === 'pw'));
  X.era('prewar');
  ok('C9 a Pre-War view lists Pre-War\'s', W.rrSetsOnView().length === 2 && W.rrSetsOnView().every(s => s._era === 'prewar'));
  X.era('all');
  ok('C10 all eras lists every set', W.rrSetsOnView().length === 4);
  X.era('mpc');
  ok('C11 an era with no set list of its own lists what is loaded, as before', W.rrSetsOnView().length === 4);

  // ── D: the one loader ──
  X.reset(); X.state().setData = clone(PW); X.sheet('Lionel Pre-War - Sets', [ROW('234', 'Passenger outfit'), ROW('96', 'Passenger outfit')]);
  ok('D1 Postwar in, Pre-War not: a list is pending', W.rrSetListsPending() === true);
  await W.rrEnsurePostwarSets();
  const sd = X.state().setData;
  ok('D2 it asked for the Pre-War Sets tab by name, once', X.calls().length === 1 && X.calls()[0] === 'Lionel Pre-War - Sets!A2:U', X.calls().join(' | '));
  ok('D3 Postwar\'s rows are all still there', sd.filter(s => s._era === 'pw').length === 2 && sd[0].setNum === '1611');
  ok('D4 the Pre-War rows joined them, tagged', sd.filter(s => s._era === 'prewar').length === 2, JSON.stringify(sd.map(s => s._era)));
  ok('D5 nothing pending any more', W.rrSetListsPending() === false);
  await W.rrEnsurePostwarSets();
  ok('D6 asking again reads nothing', X.calls().length === 1);
  X.reset(); X.state().setData = clone(PW); X.sheet('Lionel Pre-War - Sets', 'FAIL');
  await W.rrEnsurePostwarSets();
  ok('D7 a failed read loses nothing', X.state().setData.length === 2);
  ok('D8 …and counts as tried: the item box does not wait forever', W.rrSetListsPending() === false);
  X.reset(); X.sheet('Lionel PW - Sets', [ROW('1400', 'P')]); X.sheet('Lionel Pre-War - Sets', [ROW('234', 'Q')]);
  await W.rrEnsurePostwarSets();
  ok('D9 nothing loaded: both lists come in, each under its own era',
    X.state().setData.length === 2 && X.state().setData.some(s => s._era === 'pw' && s.setNum === '1400') && X.state().setData.some(s => s._era === 'prewar' && s.setNum === '234'), JSON.stringify(X.state().setData.map(s => s._era + s.setNum)));

  // ── E: the item box ──
  X.reset(); X.state().setData = clone(PW).concat(clone(PRE)); W._rrPwSetsTried = false;
  const row = W.rrSetAsRow(X.state().setData[3]);
  ok('E1 a Pre-War set is a Lionel Pre-War row: era, period, tab', row._era === 'prewar' && row.eraPeriod === 'prewar' && row._tab === 'Lionel Pre-War - Sets' && row.itemType === 'Set', JSON.stringify(row));
  const prow = W.rrSetAsRow(X.state().setData[1]);
  ok('E2 a Postwar set is described exactly as before', prow._era === 'pw' && prow.eraPeriod === 'postwar' && prow._tab === 'Lionel PW - Sets');
  const hits = W._wizPostwarSetHits('1611', null, { exact: true, anyFilter: true });
  ok('E3 1611 is TWO sets: one row per era, never merged', hits && hits.length === 2 && hits.map(h => h.era).sort().join(',') === 'prewar,pw' && hits.every(h => h.variants.length === 1), JSON.stringify(hits && hits.map(h => h.era + ':' + h.variants.length)));
  const one = W._wizPostwarSetHits('191w', null, { exact: true, anyFilter: true });
  ok('E4 191W is one Pre-War set', one && one.length === 1 && one[0].era === 'prewar' && one[0].setNum === '191W');
  X.asked().length = 0;
  W._rrSetPieceWords(X.state().setData[3]);
  ok('E5 a Pre-War set\'s pieces are looked up as Pre-War', X.asked().length === 5 && X.asked().every(a => a.era === 'prewar'), JSON.stringify(X.asked()));
  X.asked().length = 0;
  W._rrSetPieceWords(X.state().setData[1]);
  ok('E6 a Postwar set\'s as Postwar', X.asked().length === 3 && X.asked().every(a => a.era === 'pw'));
  ok('E7 the Pre-War items tab\'s old Set row is the set\'s own copy', W._wizSetCopyRow({ _tab: 'Lionel Pre-War', itemType: 'Set' }) === true && W._wizSetCopyRow({ _tab: 'Lionel PW - Items', itemType: 'Set' }) === true);
  ok('E8 …a Pre-War engine with the number is not', W._wizSetCopyRow({ _tab: 'Lionel Pre-War', itemType: 'Steam Locomotive' }) === false && W._wizSetCopyRow({ _tab: 'Lionel MPC-Modern', itemType: 'Set' }) === false);
  X.reset(); X.state().setData = clone(PW);
  const e9 = W._wizPostwarSetHits('1467w', null, { exact: true, anyFilter: true });
  ok('E9 one list in, one still to come: the box answers from what is here (never a blank wait)', e9 && e9.length === 1 && e9[0].era === 'pw' && W.rrSetListsPending() === true);
  const s8 = (sug) => /rrSetListsPending\(\) && typeof rrEnsurePostwarSets === 'function'\) \{\s*\n\s*var _hadSets/.test(sug) && /got\.length > _hadSets/.test(sug);
  ok('E10 …and the item box fetches the missing list and asks again when it lands', s8(SUG));
  ok('E10 PLANTED: the fetch of the missing list removed → caught', !s8(plant(SUG, "rrSetListsPending() && typeof rrEnsurePostwarSets === 'function') {", "false) {", 'pending fetch')));

  // ── F: saving ──
  ok('F1 a Pre-War set\'s pieces are saved under Pre-War', W.rrSetSaveEra(PRE[1]) === 'prewar');
  ok('F2 a Postwar set\'s keep the word they always had', W.rrSetSaveEra(PW[1]) === 'Postwar' && W.rrSetSaveEra({ setNum: 'x' }) === 'Postwar' && W.rrSetSaveEra(null) === 'Postwar');
  X.era('pw'); X.wiz({ data: { _resolvedSet: PRE[1] }, matchedItem: null });
  ok('F3 Postwar on screen, a Pre-War set chosen → saved as Pre-War', W._resolveSaveEra() === 'prewar', W._resolveSaveEra());
  X.wiz({ data: { _resolvedSet: PRE[1], _ownSet: true, _era: 'mpc' }, matchedItem: null });
  ok('F4 an own set is not steered by a catalog set left behind', W._resolveSaveEra() === 'mpc');
  X.wiz({ data: {}, matchedItem: null });
  ok('F5 no set: the era on screen, as before', W._resolveSaveEra() === 'pw');

  // ── S: scans, each with a planted offender ──
  const body = (src, head) => grab(src, head);
  const s1 = (appjs) => { const i = appjs.indexOf('// 2. Sets tab: steam+tender pairs, diesel configs'); const seg = appjs.slice(i, i + 900); return i > 0 && /rrPostwarSets\(\)/.test(seg) && !/\n\s*\(state\.setData \|\| \[\]\)\.forEach\(s => \{\s*\n\s*if \(s\.steam && s\.tender\)/.test(seg); };
  ok('S1 the partner map reads Postwar\'s set list only', s1(APPJS));
  ok('S1 PLANTED: the partner map reading every set → caught', !s1(plant(APPJS, "((typeof rrPostwarSets === 'function') ? rrPostwarSets() : (state.setData || [])).forEach(s => {\n    if (s.steam && s.tender) {", "(state.setData || []).forEach(s => {\n    if (s.steam && s.tender) {", 'partner map')));
  const s2 = (tools) => { const i = tools.indexOf('// Score each set'); const seg = tools.slice(i, i + 200); return i > 0 && /_pwSets\(\)\.forEach/.test(seg) && !/state\.setData\.forEach/.test(seg); };
  ok('S2 the Set Builder scores Postwar\'s sets only', s2(TOOLS));
  ok('S2 PLANTED: the Set Builder scoring every set → caught', !s2(plant(TOOLS, '_pwSets().forEach(function(s) {', 'state.setData.forEach(function(s) {', 'set builder')));
  const s3 = (data) => { const i = data.indexOf('const _fixItem = (v) => _setItemFixes[v] || v;'); const seg = data.slice(i, i + 400); return i > 0 && /rrSetEra\(s\) !== 'pw'\) return;/.test(seg); };
  ok('S3 the Postwar book\'s set fixes skip every other era\'s set', s3(DATA));
  ok('S3 PLANTED: the era guard removed → caught', !s3(plant(DATA, "    if (typeof rrSetEra === 'function' && rrSetEra(s) !== 'pw') return;", '', 'fix guard')));
  const s4 = (sug) => !/findMaster\(String\(n\), '', \{ era: 'pw' \}\)/.test(body(sug, 'function _rrSetPieceWords(')) && !/_era: 'pw', _tab/.test(body(sug, 'function rrSetAsRow('));
  ok('S4 no set lookup in the item box names Postwar by hand', s4(SUG));
  ok('S4 PLANTED: a piece lookup pinned to Postwar → caught', !s4(plant(SUG, "findMaster(String(n), '', { era: _se })", "findMaster(String(n), '', { era: 'pw' })", 'pinned lookup')));
  const s5 = (save) => !/era: isOwnSet \? \(\(master && master\._era\) \|\| ''\) : 'Postwar'/.test(save) && /rrSetSaveEra\(resolvedSet\)/.test(save);
  ok('S5 a set save never writes "Postwar" by hand', s5(SAVE));
  ok('S5 PLANTED: the hand-written era back → caught', !s5(plant(SAVE, 'rrSetSaveEra(resolvedSet),', "'Postwar',", 'hand era')));
  const s6 = (wiz) => /d\._resolvedSet && !d\._ownSet && typeof rrSetEra === 'function' && d\._resolvedSet\._era\) era = rrSetEra\(d\._resolvedSet\)/.test(body(wiz, 'function _wizMasterPrefer('));
  ok('S6 a set\'s pieces are matched in the set\'s own catalog (the one lookup preference)', s6(WIZ));
  ok('S6 PLANTED: the preference dropped → caught', !s6(plant(WIZ, "if (d._resolvedSet && !d._ownSet && typeof rrSetEra === 'function' && d._resolvedSet._era) era = rrSetEra(d._resolvedSet);", '', 'prefer')));
  const s7 = (drive) => /_eraOfSet\(_hitSet\[0\]\)/.test(drive) && !/const lab = ERAS\[H\.SET_ERA\] && ERAS\[H\.SET_ERA\]\.label;/.test(drive);
  ok('S7 a set\'s photo folder goes under the set\'s own era', s7(DRIVE));
  ok('S7 PLANTED: every set filed under Postwar → caught', !s7(plant(DRIVE, 'const lab = ERAS[_se] && ERAS[_se].label;', 'const lab = ERAS[H.SET_ERA] && ERAS[H.SET_ERA].label;', 'drive era')));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
