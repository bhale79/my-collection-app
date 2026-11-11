#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE PRODUCT-LINE PREFIX RULE — one rule for "6-18319" and "18319" (numspell)
// [stated] Brad 2026-11-10 12:01 CT "we keep hitting this dan 6- no 6- issues.
// I thought we corrected it all?" → 12:02 CT "yes" to ONE rule.
//
// His 18319 New Haven EP-5 showed no catalog parts: Lionel's parts lists file it
// as 6-18319 (101 parts) and the parts lookup only ever took a "6-" OFF. About
// 39 places in 11 files each handled the prefix their own way. Now four
// functions in app.js answer for all of them.
//   R  the rule itself (rrNumBare / rrNumFull / rrNumSame / rrNumSpellings)
//   P  the parts lookup (_partsForItem, real code): 18319 finds the parts filed
//      under 6-18319; a Postwar 3100 never gets the MPC 6-3100's parts; another
//      maker's 18319 never gets Lionel's
//   F  findMaster (real code): 18319 reaches a catalog row written 6-18319 only
//      when nothing answers as written; 6-8359 still reaches 8359
//   S  scans, each proven on a planted offender: no file outside the rule takes
//      a "6-" off or puts one on by hand
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(extra === undefined ? '' : extra).slice(0, 400))); cond ? pass++ : fail++; }
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
const APPJS = read('app.js'), DAT = read('app-data.js');

const { numRuleSource: ruleSource } = require('./lib/num-rule');   // the rule, exactly as app.js writes it

const R = {};
vm.createContext(R);
vm.runInContext(ruleSource() + '\nthis.f = { rrNumBare, rrNumFull, rrNumSame, rrNumSpellings };', R);
const { rrNumBare, rrNumFull, rrNumSame, rrNumSpellings } = R.f;
const J = v => JSON.stringify(v);

// ── R: the rule ──────────────────────────────────────────────────────────────
ok('R1 6-18319 → 18319', rrNumBare('6-18319') === '18319');
ok('R2 7-11193 → 11193 (any one-digit product line)', rrNumBare('7-11193') === '11193');
ok('R3 MTH 20-66238 stays (two digits in front)', rrNumBare('20-66238') === '20-66238');
ok('R4 Postwar 6464-1 stays (the dash comes later)', rrNumBare('6464-1') === '6464-1');
ok('R5 a wheel arrangement 2-6-4 stays', rrNumBare('2-6-4') === '2-6-4');
ok('R6 spaces trimmed, blank stays blank', rrNumBare('  18319 ') === '18319' && rrNumBare(null) === '' && rrNumBare(undefined) === '');
ok('R7 rrNumFull: 18319 → 6-18319', rrNumFull('18319') === '6-18319');
ok('R8 rrNumFull: 6-8359 unchanged, 7-11193 keeps its own line (never 6-11193)', rrNumFull('6-8359') === '6-8359' && rrNumFull('7-11193') === '7-11193');
ok('R9 rrNumFull: a number not starting with a digit is left as written', rrNumFull('K-2765') === 'K-2765' && rrNumFull('TW') === 'TW');
ok('R10 rrNumSame: 18319 = 6-18319, both ways, any case', rrNumSame('18319', '6-18319') && rrNumSame('6-18319', '18319') && rrNumSame('6-2343p', '2343P') && rrNumSame(' 18319', '18319 '));
ok('R11 rrNumSame: 20-66238 ≠ 66238, 6464-1 ≠ 6464, blank ≠ blank', !rrNumSame('20-66238', '66238') && !rrNumSame('6464-1', '6464') && !rrNumSame('', ''));
ok('R11b rrNumSame: only Lionel\'s "6-" — 7-11193 is another line, a 5-54 date stamp is not No. 54', !rrNumSame('7-11193', '6-11193') && !rrNumSame('7-11193', '11193') && !rrNumSame('5-54', '54'));
ok('R12 spellings of 18319 (no era): as written, then 6-18319', J(rrNumSpellings('18319')) === J(['18319', '6-18319']), J(rrNumSpellings('18319')));
ok('R13 spellings of 6-18319: as written, then 18319', J(rrNumSpellings('6-18319')) === J(['6-18319', '18319']), J(rrNumSpellings('6-18319')));
ok('R14 a Postwar era never gets the 6- spelling', J(rrNumSpellings('3100', { era: 'pw' })) === J(['3100']) && J(rrNumSpellings('2343', { era: 'prewar' })) === J(['2343']));
ok('R15 Lionel modern (mpc, mod_ho, mod_s) gets it', J(rrNumSpellings('8551', { era: 'mpc' })) === J(['8551', '6-8551']) && J(rrNumSpellings('48011', { era: 'mod_s' })) === J(['48011', '6-48011']));
ok('R15b an era asked but not known gets no 6- spelling (a copy whose era is blank)', J(rrNumSpellings('3100', { era: '' })) === J(['3100']));
ok('R15c no 6- spelling for a short read (54) or a number that already has a line prefix (7-11193)', J(rrNumSpellings('54')) === J(['54']) && J(rrNumSpellings('7-11193')) === J(['7-11193', '11193']));
ok('R16 a number not starting with a digit gets no 6- spelling', J(rrNumSpellings('K-2765')) === J(['K-2765']) && J(rrNumSpellings('')) === J([]));
ok('R17 another maker\'s era gets no 6- spelling', J(rrNumSpellings('18319', { era: 'shelper' })) === J(['18319']));

// ── P: the parts lookup, real code ──────────────────────────────────────────
function partsWorld(datSrc, withRule) {
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    withRule === false ? '' : ruleSource(),
    'function baseItemNum(n) { return String(n || "").trim().replace(/[-]?[PDTC]$/i, ""); }',
    'var ERAS = { pw: { manufacturer: "Lionel" }, mpc: { manufacturer: "Lionel" }, lionel_parts: { manufacturer: "Lionel" }, shelper: { manufacturer: "S-Helper Service" } };',
    'var state = { masterAllRows: [], masterData: [] };',
    'var _fitsIdx = null, _fitsIdxRows = null, _fitsIdxLen = -1;',
    grab(datSrc, 'function _partsFitsIndex('), grab(datSrc, 'function _partsMakerOf('), grab(datSrc, 'function _partsForItem('),
    'this.__set = function (rows) { state.masterAllRows = rows; };',
  ].join('\n;\n'), sb);
  return sb;
}
const part = (num, fits) => ({ itemNum: num, itemType: 'Part', fits: fits, _era: 'lionel_parts', _tab: 'Lionel Parts' });
const PARTS = [
  part('2350-11', '2350; 2351; 6-8551; 6-18311; 6-18319'),          // the EP-5 headlight lens
  part('50-100', '6-18319; 6-18311'),                                 // the ornamental horn
  part('3100-5', '6-3100'),                                           // MPC 6-3100 Great Northern only
  part('3100-PW', '3100'),                                            // a Postwar 3100 part
];
function partsFor(num, era, datSrc) {
  const w = partsWorld(datSrc || DAT);
  w.__set(PARTS.slice());
  return w._partsForItem(num, era, { itemNum: num, _era: era }).map(r => r.itemNum).sort();
}
ok('P1 Brad\'s 18319 (Lionel modern) finds the parts filed under 6-18319', J(partsFor('18319', 'mpc')) === J(['2350-11', '50-100']), J(partsFor('18319', 'mpc')));
ok('P2 typed as 6-18319 it finds the same', J(partsFor('6-18319', 'mpc')) === J(['2350-11', '50-100']), J(partsFor('6-18319', 'mpc')));
ok('P3 a 4-digit MPC 8551 finds the 6-8551 part', J(partsFor('8551', 'mpc')) === J(['2350-11']), J(partsFor('8551', 'mpc')));
ok('P4 a Postwar 3100 gets its own part and never the MPC 6-3100\'s', J(partsFor('3100', 'pw')) === J(['3100-PW']), J(partsFor('3100', 'pw')));
ok('P5 a Postwar 2350 still finds the lens filed as 2350', J(partsFor('2350', 'pw')) === J(['2350-11']), J(partsFor('2350', 'pw')));
ok('P6 an S-Helper 18319 gets none of Lionel\'s parts (the maker guard)', J(partsFor('18319', 'shelper')) === J([]), J(partsFor('18319', 'shelper')));
{
  const w = partsWorld(DAT); w.__set(PARTS.slice());
  const got = w._partsForItem('3100', undefined, { itemNum: '3100' }).map(r => r.itemNum).sort();
  ok('P8 a copy whose era is unknown never gets the MPC 6-3100\'s parts (the catalog still loading)', J(got) === J(['3100-PW']), J(got));
  const got2 = w._partsForItem('18319', undefined, { itemNum: '18319', _era: 'mpc' }).map(r => r.itemNum).sort();
  ok('P9 no era handed in, but the copy says mpc → its 6-18319 parts', J(got2) === J(['2350-11', '50-100']), J(got2));
}
{
  // planted offender: the old one-way lookup (take a 6- off, never put one on)
  const OLD = plant(DAT, "var sp = (typeof rrNumSpellings === 'function') ? rrNumSpellings(k, { era: _pe }) : [k];",
    "var sp = [k, k.replace(/^\\d-/, '')];", 'one-way spellings');
  ok('P7 PLANTED: with the old one-way lookup, 18319 finds nothing (the bug Brad hit)', J(partsFor('18319', 'mpc', OLD)) === J([]), J(partsFor('18319', 'mpc', OLD)));
}

// ── F: findMaster, real code ────────────────────────────────────────────────
function lookupWorld(datSrc) {
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    ruleSource(),
    grab(APPJS, 'function rrNumZeroKey('), grab(APPJS, 'function rrNumZeroTwin('),
    'function baseItemNum(n) { return String(n || "").trim().replace(/[-]?[PDTC]$/i, ""); }',
    'var state = { masterByItem: new Map(), masterByItemAll: null, masterByRowId: new Map(), masterByRowIdAll: null };',
    'var ERA_TABS = {}; var _lkCache = new WeakMap(); var _zkCache = new WeakMap();',
    grab(datSrc, 'function _mIsMotive('), grab(datSrc, 'function _mSuffix('),
    grab(datSrc, 'function _letterKinRows('), grab(datSrc, 'function _zeroKinRows('),
    grab(datSrc, 'function _findMasterCore('), grab(datSrc, 'function _preferEraOf('),
    grab(datSrc, 'function rrMasterByKey('), grab(datSrc, 'function rrMasterByRowId('), grab(datSrc, 'function _rrRowIdFits('),
    grab(datSrc, 'function findMaster('), grab(datSrc, 'function _mbAllGet('),
    require('./lib/row-kind').rowKindSource(undefined, datSrc.indexOf('function rrRowKind(') >= 0 ? datSrc : undefined),
    grab(datSrc, 'function _rrRealRowsOf('),
    'this.__index = function (rows) {',
    '  var m = new Map(); rows.forEach(function (r) { var k = String(r.itemNum).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });',
    '  state.masterByItem = m; state.masterByItemAll = null; state.masterByRowId = new Map();',
    '  ERA_TABS = { pw: { items: "Lionel PW - Items" }, mpc: { items: "Lionel MPC-Modern" } }; rows.forEach(function (r) { ERA_TABS[r._era] = { items: r._tab }; });',
    '};',
    'this.__index2 = function (rows, allRows) {',
    '  var mk = function (rs) { var m = new Map(); rs.forEach(function (r) { var k = String(r.itemNum).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };',
    '  state.masterByItem = mk(rows); state.masterByItemAll = mk(allRows); state.masterByRowId = new Map();',
    '  ERA_TABS = { pw: { items: "Lionel PW - Items" }, mpc: { items: "Lionel MPC-Modern" } };',
    '};',
  ].join('\n;\n'), sb);
  return sb;
}
const mrow = (num, desc, era) => ({ itemNum: num, _tab: era === 'pw' ? 'Lionel PW - Items' : 'Lionel MPC-Modern', _era: era || 'mpc', itemType: 'Electric Locomotive', description: desc, rowId: 'R' + num });
{
  const w = lookupWorld(DAT);
  w.__index([mrow('6-18319', 'New Haven EP-5')]);
  const hit = w.findMaster('18319');
  ok('F1 18319 reaches a catalog row written 6-18319', !!hit && hit.itemNum === '6-18319', hit && hit.itemNum);
  w.__index([mrow('18319', 'the row as written'), mrow('6-18319', 'the 6- twin')]);
  const h2 = w.findMaster('18319');
  ok('F2 a row written exactly as asked always wins over the 6- twin', !!h2 && h2.description === 'the row as written', h2 && h2.description);
  w.__index([mrow('8359', 'Chessie GP-7')]);
  const h3 = w.findMaster('6-8359');
  ok('F3 6-8359 still reaches the catalog\'s 8359 (as before)', !!h3 && h3.itemNum === '8359', h3 && h3.itemNum);
  w.__index([mrow('20-66238', 'MTH row')]);
  ok('F4 66238 never reaches MTH 20-66238', !w.findMaster('66238'));
  // planted offender: the old findMaster that only ever took a "6-" off
  const OLDF = plant(DAT, "    _sp.filter(s => s !== _bare).forEach(_spAdd);\n", '', 'no 6- twin');
  const wo = lookupWorld(OLDF);
  wo.__index([mrow('6-18319', 'New Haven EP-5')]);
  ok('F5 PLANTED: without the 6- twin step, 18319 finds nothing', !wo.findMaster('18319'));
  // a copy that names a Postwar catalog is never handed the MPC 6- row
  const wp = lookupWorld(DAT);
  wp.__index([mrow('6-3100', 'MPC Great Northern 4-8-4')]);
  ok('F6 a Postwar copy of 3100 (prefer era pw) never lands on the MPC 6-3100', !wp.findMaster('3100', null, { era: 'pw', manufacturer: 'Lionel' }));
  {
    const NOERA = plant(DAT, "  if (!cands.length && (!_prefSoldEra || (typeof RR_NUM_PREFIX_ERAS !== 'undefined' && RR_NUM_PREFIX_ERAS.indexOf(_prefSoldEra) >= 0))) {", "  if (!cands.length) {", 'era-blind 6- twin');
    const NOERA2 = plant(NOERA, "\n      && (!_kinNamed || _kinBelongs(r)));", ");", 'catalog-blind 6- twin');
    const we = lookupWorld(NOERA2); we.__index([mrow('6-3100', 'MPC Great Northern 4-8-4')]);
    ok('F6b PLANTED: an era- and catalog-blind 6- twin hands the Postwar copy the MPC 6-3100 (caught)', (we.findMaster('3100', null, { era: 'pw', manufacturer: 'Lionel' }) || {}).itemNum === '6-3100');
  }
  ok('F7 …while a Lionel modern copy (prefer era mpc) does', (wp.findMaster('3100', null, { era: 'mpc', manufacturer: 'Lionel' }) || {}).itemNum === '6-3100');
  // two layers: the loaded eras hold only 6-18319, the full catalog holds 18319 as written
  wp.__index2([mrow('6-18319', 'the 6- twin (loaded)')], [mrow('18319', 'as written (full catalog)'), mrow('6-18319', 'the 6- twin (loaded)')]);
  const h7 = wp.findMaster('18319');
  ok('F8 across the two layers the row written as asked still wins over a 6- twin', !!h7 && h7.itemNum === '18319', h7 && h7.itemNum);
  const OLD2 = plant(DAT, "  if (_r && (_rTwin || _rSpell) && state.masterByItemAll) {", "  if (_r && _rTwin && state.masterByItemAll) {", 'layer-1 6- twin ends the search');
  const w8 = lookupWorld(OLD2);
  w8.__index2([mrow('6-18319', 'the 6- twin (loaded)')], [mrow('18319', 'as written (full catalog)'), mrow('6-18319', 'the 6- twin (loaded)')]);
  ok('F9 PLANTED: if the loaded 6- twin ended the search, 18319 would get the twin (caught)', (w8.findMaster('18319') || {}).itemNum === '6-18319');
}

// ── S: no hand-made prefix anywhere else ─────────────────────────────────────
// A "6-" put on by hand ('6-' + n), taken off by hand (.replace(/^6-/ …),
// /^\d-/, /^6-\d/ …) or looked for by hand (indexOf('6-')) outside the rule.
const OFFENDER = [
  /['"]6-['"]\s*\+/,                         // '6-' + n
  /`6-\$\{/,                                  // `6-${n}`
  /\/\^6\\?-/,                                // /^6- …/ or /^6\- …/
  /\/\^(\\d|\[0-9\]|\(\\d\))(\{1\})?-/,         // /^\d- …/, /^[0-9]- …/, /^(\d)- …/, /^\d{1}- …/
  /RegExp\(\s*['"]\^6-/,                      // new RegExp('^6-…')
  /indexOf\(\s*['"]6-['"]\s*\)/,              // indexOf('6-')
  /startsWith\(\s*['"]6-['"]\s*\)/,           // startsWith('6-')
  /[=!]==\s*['"]6-['"]|['"]6-['"]\s*[=!]==/,    // x === '6-'
];
// A line that honestly needs a pattern like these for something that is NOT
// the catalog-number prefix (a "5-54" build-date stamp, say) says so with a
// "numspell-ok: <why>" comment and is skipped.
const ALLOW = /numspell-ok:/;
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}
function offenders(name, src) {
  let s = src.split('\n').map(l => ALLOW.test(l) ? '' : l).join('\n');
  s = stripComments(s);
  if (name === 'app.js') {     // the rule itself is the one place allowed
    const a = s.indexOf('var RR_NUM_PREFIX = '), b = s.indexOf('function rrNumSpellings(');
    const end = b >= 0 ? s.indexOf('\n}', b) : -1;
    if (a >= 0 && end > a) s = s.slice(0, a) + s.slice(end + 2);
  }
  const out = [];
  s.split('\n').forEach((line, i) => { if (OFFENDER.some(re => re.test(line))) out.push(name + ':' + (i + 1) + ' ' + line.trim().slice(0, 120)); });
  return out;
}
const RAW = {};
fs.readdirSync(APP).filter(f => /\.js$/.test(f)).forEach(f => { RAW[f] = read(f); });
const FILES = require('./lib/pin-source').pinMerge(RAW);   // the Photo Inbox pieces as ONE 'photo-inbox.js'
const files = Object.keys(FILES);
let found = [];
files.forEach(f => { found = found.concat(offenders(f, FILES[f])); });
ok('S1 no hand-made 6- handling in any app file outside the rule (' + files.length + ' files)', found.length === 0, found.join(' | '));
ok('S2 PLANTED: a hand-made "6-" + n in barcode.js is caught',
  offenders('barcode.js', FILES['barcode.js'] + "\nvar lk = [n]; lk.push('6-' + n);").length === 1);
ok('S3 PLANTED: a hand-made .replace(/^6-/, \'\') in app-data.js is caught',
  offenders('app-data.js', FILES['app-data.js'] + "\nvar b = n.replace(/^6-/, '');").length === 1);
ok('S4 PLANTED: a hand-made /^\\d-/ in the Photo Inbox is caught',
  offenders('photo-inbox.js', FILES['photo-inbox.js'] + "\nvar b = c.replace(/^\\d-/, '');").length === 1);
ok('S5 PLANTED: a hand-made indexOf(\'6-\') in import-core.js is caught',
  offenders('import-core.js', FILES['import-core.js'] + "\nif (raw.indexOf('6-') === 0) x();").length === 1);
ok('S5b PLANTED: a template literal `6-${n}`, a /^[0-9]-/ and a new RegExp(\'^6-\') are caught',
  offenders('vault.js', FILES['vault.js'] + "\nvar a = `6-${n}`;\nvar b = n.replace(/^[0-9]-/, '');\nvar c = new RegExp('^6-');").length === 3);
ok('S5c a line marked numspell-ok is not an offender (an honest date-stamp pattern)',
  offenders('vault.js', FILES['vault.js'] + "\nvar d = /^\\d-\\d{2}$/.test(t);   // numspell-ok: a 5-54 build-date stamp").length === 0);
ok('S6 the rule is written once: the four functions live only in app.js',
  files.filter(f => /function rrNum(Bare|Full|Same|Spellings)\(/.test(FILES[f])).join(',') === 'app.js');
ok('S7 the parts lookup and findMaster both ask the rule',
  /rrNumSpellings\(k, \{ era: _pe \}\)/.test(grab(DAT, 'function _partsForItem(')) && /rrNumSpellings\(k\)/.test(grab(DAT, 'function _findMasterCore(')));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
