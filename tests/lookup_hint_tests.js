// ═══════════════════════════════════════════════════════════════
// lookup_hint_tests.js — v0.9.1821 (release readiness S6 / Open List #9).
//
// THE BUG CLASS: number-only first-find. 165,000 catalog rows where Lionel,
// American Flyer, MTH, Atlas and Marx reuse numbers; a lookup that passes
// only the number gets whichever maker's row loaded first. Brad reports it
// as "it showed me the wrong item" (Atlas 3300 → a Lionel trolley; AF 520 →
// a Lionel box cab; "the Atlas hopper turned up on a Lionel item").
//
// THE RULE: every findMaster(...) outside the resolver carries a HINT as its
// third argument — the owned row (its stored key answers exactly; its era
// and maker steer the guess), the wizard's preference, the era being asked
// about, or the sale / want / upgrade record. The six places that cannot
// (they run only AFTER the owned-row path found nothing, or are the
// resolver's own fallback) are named below with their reason; a seventh is
// a failure, and so is a named one that quietly disappears.
//
// And: "look up with the hint, and if that finds nothing look up WITHOUT
// it" is gone. findMaster already falls through every catalog with the hint;
// a hint-less retry can only ever answer with another maker's row, or hand
// a manual item a catalog identity (the v732 rule).
// Section D lifts three of the fixed callers and proves the hint reaches
// findMaster. Section E plants each old habit and the scan must go red.
// Run:  node tests/lookup_hint_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const code = src => src.replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, pre) => pre + ' '.repeat(m.length - pre.length));

// The resolver itself and its own core are exempt (they ARE the lookup).
const RESOLVER = new Set(['app-data.js']);

// The six number-only calls that may stay, each with the line it must sit on.
// Every one runs only after the owned-row path came up empty (or is the
// resolver's fallback when the bucket lookup is absent).
const ALLOWED = [
  { file: 'app-pages.js',   on: "_pdFor ? findMaster(_pdFor.itemNum, _pdFor.variation, _pdFor) : findMaster(p.forItem)", why: 'Parts Needed "For" label: the owned copy first; number only when the part names no owned copy' },
  { file: 'drive.js',       on: "const m = findMaster(n);",                                                                 why: 'photo-name era label: runs only after the owned row (`based`) gave no era' },
  { file: 'maintenance.js', on: "if (!_prs.length) { var _pr1 = findMaster(pn); if (_pr1) _prs = [_pr1]; }",                 why: 'parts drawer: fallback for when _mbAllGet (the real bucket lookup) is not loaded — tests lift this bare' },
  { file: 'maintenance.js', on: "pd ? findMaster(pd.itemNum, pd.variation, pd) : findMaster(p.forItem)",                    why: 'Parts Bin spoken-for line: the owned copy first' },
  { file: 'maintenance.js', on: "pd ? findMaster(pd.itemNum, pd.variation, pd) : findMaster(itemNum)",                      why: 'Workbench item label: the owned copy (by inventory id) first' },
  { file: 'maintenance.js', on: "_lpd ? findMaster(_lpd.itemNum, _lpd.variation, _lpd) : findMaster(l.itemNum)",           why: 'Workbench history search: the log entry\'s owned copy first' },
];

// Every findMaster( call with its argument count (paren- and string-aware).
function fmCalls(src) {
  const out = [];
  const re = /(?<![\w$.])findMaster\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;   // the definition
    let i = m.index + m[0].length, d = 1, inS = null;
    for (; i < src.length && d > 0; i++) {
      const c = src[i];
      if (inS) { if (c === '\\') { i++; continue; } if (c === inS) inS = null; continue; }
      if (c === "'" || c === '"' || c === '`') { inS = c; continue; }
      if (c === '(') d++; else if (c === ')') d--;
    }
    const args = src.slice(m.index + m[0].length, i - 1);
    let n = args.trim() ? 1 : 0, dd = 0; inS = null;
    for (let j = 0; j < args.length; j++) {
      const c = args[j];
      if (inS) { if (c === '\\') { j++; continue; } if (c === inS) inS = null; continue; }
      if (c === "'" || c === '"' || c === '`') { inS = c; continue; }
      if ('([{'.indexOf(c) >= 0) dd++; else if (')]}'.indexOf(c) >= 0) dd--; else if (c === ',' && dd === 0) n++;
    }
    const at = src.slice(0, m.index).split('\n').length;
    out.push({ at, n, line: src.split('\n')[at - 1] });
  }
  return out;
}
// A hint-less retry: `findMaster(a, b, c) || findMaster(a)` in any spelling.
const RETRY = /\|\|\s*findMaster\(\s*[^,()]*\s*\)/;

function scan(files) {
  const bare = [], retries = [], seen = new Set();
  files.forEach(({ f, src }) => {
    if (RESOLVER.has(f)) return;
    const c = code(src);
    fmCalls(c).forEach(h => {
      if (h.n >= 3) return;
      const allowed = ALLOWED.find(a => a.file === f && h.line.indexOf(a.on) >= 0);
      if (allowed) { seen.add(allowed.on); return; }
      bare.push(f + ':' + h.at + ' (' + h.n + ' arg' + (h.n === 1 ? '' : 's') + ')');
    });
    c.split('\n').forEach((ln, i) => { if (RETRY.test(ln)) retries.push(f + ':' + (i + 1)); });
  });
  return { bare, retries, missing: ALLOWED.filter(a => !seen.has(a.on)).map(a => a.file + ': ' + a.on.slice(0, 40)) };
}
const FILES = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).sort().map(f => ({ f, src: fs.readFileSync(path.join(APP, f), 'utf8') }));

section('A · every lookup outside the resolver carries a hint');
const R = scan(FILES);
const total = FILES.filter(x => !RESOLVER.has(x.f)).reduce((s, x) => s + fmCalls(code(x.src)).length, 0);
ok('A1  the scan sees the app\'s lookups (' + total + ' findMaster calls outside app-data.js)', total > 100, String(total));
ok('A2  zero number-only lookups beyond the six named fallbacks', R.bare.length === 0, R.bare.join(', '));
ok('A3  every named fallback is still where it says it is (a stale exception is a lie)', R.missing.length === 0, R.missing.join(' | '));
ok('A4  no "try again with no hint" retry anywhere', R.retries.length === 0, R.retries.join(', '));
ok('A5  each named fallback says why', ALLOWED.every(a => a.why && a.why.length > 20));
ok('A6  the dead _upgradeGotItOldStart is gone (no caller, bare lookup)', !/_upgradeGotItOldStart\s*\(/.test(code(FILES.find(x => x.f === 'app-pages.js').src)));

section('D · the hint actually reaches findMaster (lifted callers, spy resolver)');
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
const APPJS = FILES.find(x => x.f === 'app.js').src, MAINT = FILES.find(x => x.f === 'maintenance.js').src;
(function () {
  const calls = [];
  const spy = function (n, v, p) { calls.push({ n, v, p }); return { _era: 'pw', itemNum: n, roadName: 'Road' }; };
  const isIn = new Function('findMaster', 'state', '_currentEra', grab(APPJS, 'function _isInCurrentEra(itemNum)') + '; return _isInCurrentEra;')(spy, { masterData: [1] }, 'atlas');
  isIn('3300');
  ok('D1  _isInCurrentEra asks the catalog for the era it is checking ({era: atlas})', calls.length === 1 && calls[0].p && calls[0].p.era === 'atlas', JSON.stringify(calls[0]));
})();
(function () {
  const calls = [];
  const spy = function (n, v, p) { calls.push({ n, v, p }); return {}; };
  const src = { itemNum: '520-P', variation: '1', era: 'pw', masterKey: 'pw|520|1', inventoryId: '9' };
  const build = new Function('findMaster', 'state', grab(APPJS, 'function _buildSoldRow(opts)') + '; return _buildSoldRow;')(spy, { personalData: {} });
  try { build({ itemNum: '520-P', src: src }); } catch (e) {}
  ok('D2  the Sold-row builder hands findMaster the copy being sold (key, era and all)', calls.length === 1 && calls[0].p === src && calls[0].v === '1', JSON.stringify(calls[0]));
})();
(function () {
  const calls = [];
  const spy = function (n, v, p) { calls.push({ n, v, p }); return { roadName: 'Road' }; };
  const pd = { itemNum: '6457', variation: '2', era: 'pw', inventoryId: '42' };
  const label = new Function('findMaster', 'state', '_esc', grab(MAINT, 'function _wbItemLabel(itemNum, invId)') + '; return _wbItemLabel;')(spy, { personalData: { '42': pd } }, s => s);
  label('6457', '42'); label('6457', '');
  ok('D3  the Workbench label resolves through the owned copy when the row names one, by number only when it does not',
     calls.length === 2 && calls[0].p === pd && calls[0].v === '2' && calls[1].p === undefined, JSON.stringify(calls));
})();

section('E · planted offenders — the scan must fire');
const clean = FILES.find(x => x.f === 'stock-photos.js');
const plant = extra => scan([{ f: clean.f, src: clean.src + '\n' + extra + '\n' }]);
ok('E0  the sample file is clean to start', plant('').bare.length === 0 && plant('').retries.length === 0);
ok('OFFENDER 1: a number-only findMaster(n) -> A2 red', plant("var _m = findMaster(n);").bare.length === 1);
ok('OFFENDER 2: number + variation, no row -> A2 red', plant("var _m = findMaster(pd.itemNum, pd.variation);").bare.length === 1);
ok('OFFENDER 3: the hint-less retry -> A4 red', plant("var _m = findMaster(n, '', pd) || findMaster(n);").retries.length === 1);
ok('OFFENDER 4 (negative): three arguments is the rule -> green', plant("var _m = findMaster(pd.itemNum, pd.variation, pd);").bare.length === 0);
ok('OFFENDER 5 (negative): a nested call inside the third argument still counts as three', plant("var _m = findMaster(n, '', _partsOwnedRow(p.inv) || { era: eraOf(n, x) });").bare.length === 0);
ok('OFFENDER 6 (negative): the old habit in a comment stays green', plant("// was: findMaster(n)").bare.length === 0);
ok('OFFENDER 7: a named fallback that goes missing -> A3 red', scan(FILES.map(x => x.f === 'drive.js' ? { f: x.f, src: x.src.replace('const m = findMaster(n);', 'const m = findMaster(n, "", based);') } : x)).missing.length === 1);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
