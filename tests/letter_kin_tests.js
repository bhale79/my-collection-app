#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LETTER KIN — v0.9.1885
//
// [stated] Brad (2026-10-05, his Baby Ruth boxcar, lettered X6014): "the photo
// inbox does not read x6014 just 6014 and so the baby ruth 6014 is not an
// option". The catalogue files the car under X6014; a plain 6014 also exists
// (Chun King, Frisco, Wix Filters), so the v1730 bridge in findMaster — which
// only ever fills a BLANK — was never consulted, and the "pick the one you
// have" list never mentioned X6014.
//
// A letter before the same digits is a relative the way a dash after them is:
//   A  the REAL rrDashedKin (app.js): 6014 → X6014 (once), beside the dashed
//      relatives; only the catalogue's own spellings; one letter, the digits
//      exactly; ONLY in a catalogue that also holds the plain number (measured
//      2026-10-05 on the whole master: Lionel's stamp letter is X and only X;
//      Weaver's U1001, K-Line's K102, USA Trains' R12000 and the L-series
//      lamps are product codes on digits Lionel also uses — never offered);
//      a specific X6014 or 6014-1 is not second-guessed
//   B  the REAL "pick the one you have" panel (photo-inbox.js) lists X6014
//      Baby Ruth Boxcar, tappable, after the plain number's identities
//   C  the REAL rrCatalogCandidates (app-data.js — the "Change catalog entry"
//      cards): 6014 offers the X6014 rows too, each once
//   D  PLANTED: the old rrDashedKin and the old rrCatalogCandidates leave the
//      Baby Ruth out — each turns its check red
// Run:  node tests/letter_kin_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APPD = path.join(__dirname, '..', 'app');
const AJ = fs.readFileSync(path.join(APPD, 'app.js'), 'utf8');
const AD = fs.readFileSync(path.join(APPD, 'app-data.js'), 'utf8');
const PI = fs.readFileSync(path.join(APPD, 'photo-inbox.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}

// Brad's 6014 family, as his Postwar tab has it (read 2026-10-05), plus the
// shapes that must NOT be relatives.
const PW = 'Lionel PW - Items';
const row = (num, road, desc, id, x) => Object.assign({ itemNum: num, _era: 'pw', _tab: PW, roadName: road, description: desc, rowId: id, variation: '1', refLink: 'https://example.test/' + num }, x || {});
const ROWS = [
  row('6014', 'Chun King', 'Chun King Boxcar', 'R6014A0001'),
  row('6014', 'Frisco', 'Frisco Boxcar', 'R6014A0002', { variation: '2' }),
  row('6014', 'Wix Filters', 'Wix Filters Boxcar', 'R6014A0006', { variation: '6' }),
  row('6014-1', 'Bosco', 'Bosco Boxcar', 'R6014B0001'),
  row('6014-60', 'Bosco', 'Bosco Boxcar', 'R6014C0001'),
  row('X6014', 'Baby Ruth', 'Baby Ruth Boxcar', 'RX6014A001'),                              // 1952-53, white
  row('X6014', 'Baby Ruth', 'Baby Ruth Boxcar', 'RX6014A002', { variation: '2' }),          // 1954-57, red — Brad's
  row('X6004', 'Baby Ruth', 'Baby Ruth Boxcar', 'RX6004A001'),                              // the v1730 case: no plain 6004
  row('6034', 'Baby Ruth', 'Baby Ruth Boxcar', 'R6034A0001'),
  row('60140', 'Nobody', 'A longer bare number', 'R60140A001'),                             // a prefix is not a relative
  row('XX6014', 'Nobody', 'Two letters', 'RXX6014A01'),                                     // two letters are not the stamp
  row('X60140', 'Nobody', 'A letter and more digits', 'RX60140A01'),
  row('6014', 'Nobody', 'A different maker\'s 6014', 'A6014A0001', { _era: 'atlas', _tab: 'Atlas O' }),
  // measured on the whole master 2026-10-05: other makers' letters are product codes, not the stamp
  row('1001', 'Lionel', 'Scout Locomotive', 'R1001A0001'),
  row('U1001', 'Weaver', 'Weaver U-series car', 'WU1001A001', { _era: 'weaver', _tab: 'Weaver O' }),
  row('K102', 'K-Line', 'K-Line 102', 'KK102A0001', { _era: 'kline', _tab: 'K-Line O' }),
  row('102', 'Lionel', 'Prewar 102', 'P102A00001', { _era: 'prewar', _tab: 'Lionel Pre-War' }),
  row('6454', 'Atlas', 'Atlas 6454', 'A6454A0001', { _era: 'atlas', _tab: 'Atlas O' }),
  row('X6454', 'Erie', 'Erie Boxcar', 'RX6454A001'),
];
function indexOf(rows) { const m = new Map(); rows.forEach(r => { const k = String(r.itemNum); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; }

function kinFn(src) {
  const sb = { state: { masterData: ROWS } };
  vm.createContext(sb);
  vm.runInContext(src + '\nthis.f = rrDashedKin;', sb);
  return sb.f;
}

section('A — rrDashedKin: the letter stamped on the car is a relative');
{
  const kin = kinFn(grab(AJ, 'function rrDashedKin(num)'));
  const k = kin('6014');
  ok('A1  6014 → X6014 is offered, once', k.filter(x => x === 'X6014').length === 1, k);
  ok('A2  …beside the dashed relatives, which are unchanged', k.indexOf('6014-1') >= 0 && k.indexOf('6014-60') >= 0, k);
  ok('A3  a longer bare number, two letters, or a letter and more digits are NOT relatives', ['60140', 'XX6014', 'X60140', 'X6004'].every(x => k.indexOf(x) < 0), k);
  ok('A4  the plain number itself is not in its own list', k.indexOf('6014') < 0, k);
  ok('A5  601 reaches nothing (not a prefix match)', kin('601').length === 0, kin('601'));
  ok('A6  6004 → nothing here: no plain 6004 in any catalogue, so findMaster\'s v1730 bridge answers that one, not the kin list', kin('6004').length === 0, kin('6004'));
  ok('A6b 1001 → NOT Weaver\'s U1001: another maker\'s letter is a product code, not the stamp (measured: 1,011 such Weaver numbers)', kin('1001').length === 0, kin('1001'));
  ok('A6c 102 → NOT K-Line\'s K102, for the same reason', kin('102').length === 0, kin('102'));
  ok('A6d 6454 (Atlas has the plain number, Lionel has X6454) → NOT offered: the same catalogue must spell it both ways', kin('6454').length === 0, kin('6454'));
  ok('A7  a specific X6014 is not second-guessed (no plain-number relatives invented)', kin('X6014').length === 0, kin('X6014'));
  ok('A8  a dashed number still names its parent only', kin('6014-1').join(',') === '6014', kin('6014-1'));
  ok('A9  the letter rule is spelled from the catalogue, never a list of letters to try, and only in an era that holds the plain number', /s\.slice\(1\) === n && \/\^\[A-Za-z\]\$\/\.test\(s\.charAt\(0\)\)\s*&& plainEras\[String\(rows\[i\]\._era \|\| ''\)\]/.test(grab(AJ, 'function rrDashedKin(num)')));
}

section('B — the "pick the one you have" panel lists X6014 Baby Ruth');
function panel(kinSrc) {
  const sb = {
    console,
    window: { rrDemotedRow: r => false },
    state: { masterData: ROWS },
    _pinKinRowsFor: n => ROWS.filter(r => r.itemNum === String(n).trim()),
    _prefEras: p => (p && p.era) ? [p.era] : [],
    _rvPrefer: () => ({ era: 'pw' }),
    rrEsc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
  };
  vm.createContext(sb);
  vm.runInContext(kinSrc, sb);
  vm.runInContext(grab(PI, 'function _pinCardRowFor(n)') + '\n' + grab(PI, 'function _pinKinPanelHtml(num, matched, readAlts)') + '\nthis.panel = _pinKinPanelHtml;', sb);
  return sb.panel;
}
function lines(html) {
  const out = []; const re = /<button type="button" onclick="([^"]*)" style="([^"]*)">([\s\S]*?)<\/button>/g; let m;
  while ((m = re.exec(html))) { out.push({ label: (m[3].match(/font-family:var\(--font-mono\)[^>]*>([^<]*)<\/span>/) || [])[1] || '', desc: (m[3].match(/white-space:nowrap">([^<]*)<\/span>/) || [])[1] || '', tap: m[1] }); }
  return out;
}
{
  const html = panel(grab(AJ, 'function rrDashedKin(num)'))('6014', ROWS[0], []);
  const L = lines(html);
  const x = L.find(l => l.label === 'X6014');
  ok('B1  the panel renders for 6014 with the plain number\'s identities first', L.length >= 4 && L[0].label === '6014' && /Chun King/.test(L[0].desc), L.map(l => l.label + ':' + l.desc));
  ok('B2  X6014 is a line, described as the Baby Ruth Boxcar', !!x && /Baby Ruth Boxcar/.test(x.desc), L.map(l => l.label + ':' + l.desc));
  ok('B3  tapping it picks X6014 — the card then resolves to the Baby Ruth, not a 6014', !!x && x.tap === "_pinPickNum('X6014')", x && x.tap);
  ok('B4  it comes after the dashed relatives, in catalogue order', L.map(l => l.label).join(' ') === '6014 6014 6014 6014-1 6014-60 X6014', L.map(l => l.label).join(' '));
  ok('B5  the head still invites the pick', /pick the one you have/.test(html));
  ok('B6  no "AI" anywhere in it', !/\bAI\b/.test(html));
}

section('C — rrCatalogCandidates (Change catalog entry) offers the X6014 rows');
function candFn(src) {
  const sb = { state: { masterByItem: indexOf(ROWS.filter(r => r._era === 'pw')), masterByItemAll: indexOf(ROWS) }, baseItemNum: n => n, WeakMap };
  vm.createContext(sb);
  vm.runInContext('var _lkCache = new WeakMap();\n' + grab(AD, 'function _letterKinRows(idx, bare)') + '\n' + src + '\nthis.f = rrCatalogCandidates;', sb);
  return sb.f;
}
{
  const cands = candFn(grab(AD, 'function rrCatalogCandidates(itemNum)'));
  const c = cands('6014');
  const ids = c.map(r => r.rowId);
  ok('C1  6014 offers both X6014 rows (two variations), each once', ids.filter(i => i === 'RX6014A001').length === 1 && ids.filter(i => i === 'RX6014A002').length === 1, ids);
  ok('C2  …after the rows under the number itself, every maker', ids.slice(0, 3).join(',') === 'R6014A0001,R6014A0002,R6014A0006' && ids.indexOf('A6014A0001') >= 0, ids);
  ok('C3  nothing else sneaks in (no X6004, no XX6014, no 60140)', ['RX6004A001', 'RXX6014A01', 'R60140A001', 'RX60140A01'].every(i => ids.indexOf(i) < 0), ids);
  ok('C4  X6014 asked by name offers its own rows only', cands('X6014').map(r => r.rowId).join(',') === 'RX6014A001,RX6014A002', cands('X6014').map(r => r.rowId));
  ok('C5  1001 offers Lionel\'s 1001 and NOT Weaver\'s U1001 (another maker\'s product code)', cands('1001').map(r => r.rowId).join(',') === 'R1001A0001', cands('1001').map(r => r.rowId));
  ok('C6  6454 (Atlas plain, Lionel X6454) does not cross makers', cands('6454').map(r => r.rowId).join(',') === 'A6454A0001', cands('6454').map(r => r.rowId));
}

section('D — planted offenders');
{
  const src = grab(AJ, 'function rrDashedKin(num)');
  const i = src.indexOf('        else if (anyPlain &&'), j = src.indexOf('      } else {', i);
  if (i < 0 || j < 0) throw new Error('planted rrDashedKin: the block moved; update this test');
  const old = src.slice(0, i) + src.slice(j);
  const k = kinFn(old)('6014');
  ok('D1  PLANTED: the old rrDashedKin (no letter rule) leaves X6014 out — A1 would go red', k.indexOf('X6014') < 0 && k.indexOf('6014-1') >= 0, k);
  const L = lines(panel(old)('6014', ROWS[0], []));
  ok('D2  PLANTED: …and the panel never lists the Baby Ruth — B2 would go red', !L.some(l => l.label === 'X6014'), L.map(l => l.label));
  const csrc = grab(AD, 'function rrCatalogCandidates(itemNum)');
  const ci = csrc.indexOf('      if (plain.length && typeof _letterKinRows'), cj = csrc.indexOf('    });', ci);
  const cold = (ci < 0 || cj < 0) ? csrc : csrc.slice(0, ci) + csrc.slice(cj);
  if (cold === csrc) throw new Error('planted rrCatalogCandidates: the line moved; update this test');
  const ids = candFn(cold)('6014').map(r => r.rowId);
  ok('D3  PLANTED: the old rrCatalogCandidates offers no X6014 — C1 would go red', !ids.some(i => /^RX6014/.test(i)) && ids.length >= 3, ids);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
