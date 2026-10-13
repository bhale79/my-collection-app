// ═══════════════════════════════════════════════════════════════════════════
// also_sold_as_tests.js — v0.9.1935. The "Also Sold As" column.
//
// [stated] Brad 2026-10-13, on MTH's licensed "Lionel Corporation Tinplate"
// trains (made by MTH, MTH's own 11- numbers, the Lionel name on them): "we
// need to figure out how someone can find them either way because it is
// confusing." 374 of them had been typed onto Lionel MPC-Modern a second time.
//
// One item, one row (on the MTH tab), found under EITHER maker:
//   A  the column is read by its header name; a tab without it reads blank
//   B  rrRowAlsoSoldBy — "Lionel Corporation" is Lionel, never MTH or Atlas
//   C  every maker FILTER asks rrRowAlsoSoldBy after its own test
//      — PLANTED: the scan is run on a copy with the call taken out of each
//        site in turn, and must fail every time
//   D  behaviour: the barcode maker check lets the row through as Lionel
//   E  the chip: "as LIONEL", hover "Made by MTH — sold as Lionel Corporation";
//      drawn wherever the line badge is, on the Add-screen rows and the item page
//   F  findable by its words; the catalog cache is re-read (new row shape)
//
// Run:  node tests/also_sold_as_tests.js
// Proven to FAIL on v0.9.1934 (commit d9810ed) before the build.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const src = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail)))); cond ? pass++ : fail++; }
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(text, head) {
  const i = text.indexOf(head);
  if (i < 0) return '';
  let d = 0, j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) {
    if (text[k] === '{') d++;
    else if (text[k] === '}') { d--; if (d === 0) return text.slice(i, k + 1); }
  }
  return '';
}
function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }

const appjs = src('app.js'), browse = src('browse.js'), wiz = src('wizard.js'),
      sugg = src('wizard-suggestions.js'), bc = src('barcode.js'), coll = src('app-collection.js'),
      badges = src('era-badges.js'), bcfg = src('era-badges-config.js'), cfg = src('config.js');

// ── A · the column ─────────────────────────────────────────────────────────
section('A · "Also Sold As" is read by its header name');
const A = safe(() => require('../tools/master-audit/audit.js').loadApp(), null);
const H1 = ['Item Number', 'Item Type', 'Description', 'Row ID', 'Also Sold As'];
const H0 = ['Item Number', 'Item Type', 'Description', 'Row ID'];
const r1 = A && safe(() => A.parseMasterRow(['11-1007-1', 'Steam Locomotive', 'Std. Gauge Steam Engine', 'ABCDEFGH23', 'Lionel Corporation'], 'MTH Tinplate', A.buildMasterColMap(H1)), null);
const r0 = A && safe(() => A.parseMasterRow(['11-1007-1', 'Steam Locomotive', 'Std. Gauge Steam Engine', 'ABCDEFGH23'], 'MTH Tinplate', A.buildMasterColMap(H0)), null);
T('A1 the cell lands on the row as alsoSoldAs', !!r1 && r1.alsoSoldAs === 'Lionel Corporation', r1 && r1.alsoSoldAs);
T('A2 a tab without the column reads blank', !!r0 && (r0.alsoSoldAs || '') === '', r0 && r0.alsoSoldAs);
T('A3 the column does not disturb its neighbours', !!r1 && r1.rowId === 'ABCDEFGH23' && r1.itemNum === '11-1007-1');

// ── B · the rule ───────────────────────────────────────────────────────────
section('B · rrRowAlsoSoldBy — one rule, in app.js');
const lifted = safe(() => new Function(
  grab(appjs, 'function rrAlsoSoldAsNames(') + '\n' + grab(appjs, 'function _rrMakerWord(') + '\n' + grab(appjs, 'function rrRowAlsoSoldBy(') +
  '\nreturn { names: rrAlsoSoldAsNames, by: rrRowAlsoSoldBy };')(), null);
const by = (row, w) => !!(lifted && lifted.by(row, w));
const LC = { itemNum: '11-1007-1', _tab: 'MTH Tinplate', alsoSoldAs: 'Lionel Corporation' };
T('B1 published on window', /window\.rrRowAlsoSoldBy\s*=\s*rrRowAlsoSoldBy/.test(appjs) && /window\.rrAlsoSoldAsNames\s*=/.test(appjs));
T('B2 "Lionel Corporation" is Lionel — every shape the filters hold', by(LC, 'lionel') && by(LC, 'Lionel') && by(LC, 'LIONEL') && by(LC, ' Lionel '));
T('B3 …and never MTH, Atlas or a blank maker', !by(LC, 'mth') && !by(LC, 'MTH') && !by(LC, 'atlas') && !by(LC, ''));
T('B4 a row without the cell is no one else\'s', !by({ itemNum: '11-1007-1', _tab: 'MTH Tinplate' }, 'lionel') && !by(null, 'lionel'));
const two = { alsoSoldAs: 'Lionel Corporation; American Flyer' };
T('B5 several names, ";" between them — each one counts', by(two, 'american flyer') && by(two, 'Lionel') && !by(two, 'marx'),
  lifted && lifted.names(two));
T('B6 what the row is MADE by is untouched (_manufacturerOfItem never reads the column)',
  !/alsoSoldAs/.test(grab(appjs, 'function _manufacturerOfItem(')));

// ── C · every maker filter asks it ─────────────────────────────────────────
section('C · every maker filter asks rrRowAlsoSoldBy after its own test');
// Each site: the file, the filter's own test (an anchor that exists today), and
// how far after it the Also Sold As question must appear.
const SITES = [
  ['browse.js — Master Catalog maker chip', 'browse', '_itmMfr !== _stp3b.manufacturer', 160],
  ['wizard-suggestions.js — Add-screen list', 'sugg', 'String(_mMfr).toLowerCase() !== String(_effMfr).toLowerCase()', 200],
  ['wizard.js — part-number narrowing', 'wiz', 'if (_rm !== _pfM && _tab.indexOf(_pfM) !== 0', 200],
  ['wizard.js — right-maker row swap', 'wiz', 'if (_rm && _rm.indexOf(_fm) < 0', 200],
  ['wizard.js — the found-row scorer', 'wiz', "indexOf(mfrLC) === 0) sc += 4;", 200],
  ['barcode.js — _bcRowIsMfr', 'bc', 'function _bcRowIsMfr(', 900],
];
function scan(files) {
  return SITES.map(function (s) {
    const text = files[s[1]];
    const i = text.indexOf(s[2]);
    if (i < 0) return { site: s[0], ok: false, why: 'anchor gone' };
    const win = s[1] === 'bc' ? grab(text, s[2]) : text.slice(i, i + s[2].length + s[3]);
    return { site: s[0], ok: /rrRowAlsoSoldBy\(/.test(win), why: 'no rrRowAlsoSoldBy' };
  });
}
const FILES = { browse, sugg, wiz, bc };
scan(FILES).forEach(r => T('C · ' + r.site, r.ok, r.why));
// PLANTED: take the call out of one site at a time — the scan must catch each.
let caught = 0;
SITES.forEach(function (s, idx) {
  const planted = Object.assign({}, FILES);
  const text = planted[s[1]], i = text.indexOf(s[2]);
  if (i < 0) return;
  const end = s[1] === 'bc' ? i + grab(text, s[2]).length : i + s[2].length + s[3];
  planted[s[1]] = text.slice(0, i) + text.slice(i, end).replace(/rrRowAlsoSoldBy\(/g, 'rrSomethingElse(') + text.slice(end);
  if (!scan(planted)[idx].ok) caught++;
});
T('C · PLANTED: removing the call from any one of the ' + SITES.length + ' sites fails the scan', caught === SITES.length, caught + ' of ' + SITES.length);

// ── D · behaviour ──────────────────────────────────────────────────────────
section('D · behaviour — the barcode maker check, run for real');
const bcFns = safe(() => new Function('rrRowAlsoSoldBy',
  grab(bc, 'function _bcMfrKey(') + '\n' + grab(bc, 'function _bcRowIsMfr(') + '\nreturn _bcRowIsMfr;')(lifted ? lifted.by : undefined), null);
T('D1 an MTH-tab row marked Lionel Corporation passes a Lionel check', !!bcFns && bcFns(LC, 'lionel') === true);
T('D2 the same row without the mark does not', !!bcFns && bcFns({ itemNum: '11-1007-1', _tab: 'MTH Tinplate' }, 'lionel') === false);
T('D3 it still passes as MTH (its own maker)', !!bcFns && bcFns(LC, 'mth') === true);

// ── E · the chip ───────────────────────────────────────────────────────────
section('E · the chip says why it turned up under either maker');
const win = {};
const ctx = { window: win, document: {}, rrAlsoSoldAsNames: lifted ? lifted.names : undefined,
              _brandOfItem: function (it) { return /^MTH/.test(it._tab || '') ? 'MTH' : 'Lionel'; } };
vm.createContext(ctx);
safe(() => { vm.runInContext(bcfg, ctx); vm.runInContext(badges, ctx); }, null);
const CFG = win.ERA_BADGES || {};
T('E1 the wording lives in era-badges-config.js (alsoSoldAs: label + title)', !!(CFG.alsoSoldAs && CFG.alsoSoldAs.label && CFG.alsoSoldAs.title));
const chip = safe(() => win.alsoSoldAsChipHTML(LC), '');
T('E2 the chip reads "as Lionel"', /as Lionel/.test(chip), chip);
T('E3 its hover names both makers', /Made by MTH/.test(chip) && /sold as Lionel Corporation/.test(chip), chip);
T('E4 nothing for a row without the cell', safe(() => win.alsoSoldAsChipHTML({ _tab: 'MTH Tinplate' }), 'x') === '');
T('E5 lineBadgeHTML carries it, so every catalog row, card and list shows it', /as Lionel/.test(safe(() => win.lineBadgeHTML(LC), '')));
T('E6 themed vars only — no new hex colours', !/#[0-9a-fA-F]{3,6}\b/.test(grab(badges, 'function alsoSoldAsChipHTML(')));
T('E7 the Add-screen list draws it', /alsoSoldAsChipHTML\(c\)/.test(sugg) && /alsoSoldAs:\s*m\.alsoSoldAs/.test(sugg));
T('E8 the item page draws it', /alsoSoldAsChipHTML\(it/.test(coll) && /alsoSoldAs: _baseItem/.test(coll));

// ── F · findable, re-read ──────────────────────────────────────────────────
section('F · findable by its words; saved catalogs re-read');
T('F1 the Master Catalog search reads the cell', /haystack = `[^`]*item\.alsoSoldAs/.test(browse));
const cv = (cfg.match(/CATALOG_CACHE_VER\s*=\s*'(\d+)'/) || [])[1];
T('F2 CATALOG_CACHE_VER bumped for the new row shape (>= 129)', +cv >= 129, cv);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('ALSO-SOLD-AS TESTS FAILING'); process.exit(1); }
console.log('ALL ALSO-SOLD-AS TESTS GREEN (' + pass + ')');
