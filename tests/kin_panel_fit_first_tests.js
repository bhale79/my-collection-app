// ════════════════════════════════════════════════════════════════════════
// kin_panel_fit_first_tests.js — v0.9.1832
//
// THE RELATIVES THE READ NARROWED TO COME FIRST, MARKED.
//
// Brad's Great Northern boxcar, the last S9 phone check, 2026-09-28. v1831
// read it right — the card said "Family: 6464 heads 196 dashed relatives …
// narrowed to 6464-25 or 6464-450 on: GREAT, NORTHERN" — and the pick panel
// under that very sentence listed 6464-1, 6464-25, 6464-50, 6464-75,
// 6464-100 … in catalogue order, as though nothing had been learned. Brad:
// "yes" to putting the two that fit at the top, marked, the rest below.
//
// These tests run the REAL _pinKinPanelHtml (brace-matched out of
// photo-inbox.js) with the REAL rrDashedKin out of app.js over a family of
// rows shaped like his catalog's. Section F plants the old panel — the one
// that ignored the read — and requires red.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}

// The family, shaped like Brad's catalog. -25 / -450 (Great Northern), -525
// (Minneapolis & St. Louis) and -1 (Western Pacific) are the rows his live
// catalog answered with on 2026-09-28; the rest are the neighbours his panel
// listed. One BOX row rides along (demoted — never a line of its own).
const row = (num, era, road, desc, extra) => Object.assign({ itemNum: num, _era: era, roadName: road, description: desc, _tab: 'Lionel PW - Items', refLink: 'https://example.test/' + num }, extra || {});
const ROWS = [
  row('6464-1',   'pw', 'Western Pacific', 'Western Pacific Boxcar'),
  row('6464-25',  'pw', 'Great Northern', 'Great Northern Boxcar'),
  row('6464-25',  'pw', '', 'Great Northern Boxcar, 6', { _tab: 'Lionel PW - Boxes', _box: true }),
  row('6464-50',  'pw', 'Minneapolis & St. Louis', 'Minneapolis & St. Louis Boxcar'),
  row('6464-75',  'pw', 'Rock Island', 'Rock Island Boxcar'),
  row('6464-100', 'pw', 'Western Pacific', 'Western Pacific Boxcar (feather)'),
  row('6464-450', 'pw', 'Great Northern', 'Great Northern Boxcar'),
  row('6464-525', 'pw', 'Minneapolis & St. Louis', 'Minneapolis & St. Louis Boxcar'),
  row('6464-999', 'modern', 'Nowhere', 'A relative from another era'),
  // a second family, for the "typed over the read" case
  row('6436-1',   'pw', 'Lehigh Valley', 'Lehigh Valley Hopper'),
  row('6436-110', 'pw', 'Lehigh Valley', 'Lehigh Valley Hopper (red)'),
];

function build(opts) {
  opts = opts || {};
  const sb = {
    console,
    window: { rrDemotedRow: r => !!(r && r._box) },
    state: { masterData: ROWS },
    _pinKinRowsFor: n => ROWS.filter(r => r.itemNum === String(n).trim()),
    _prefEras: p => (p && p.era) ? [p.era] : [],
    _rvPrefer: () => ({ era: 'pw' }),
    rrEsc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
  };
  vm.createContext(sb);
  vm.runInContext(grab(APP, 'function rrDashedKin(num)'), sb);
  vm.runInContext((opts.panelSource || grab(SRC, 'function _pinKinPanelHtml(num, matched, readAlts)')) + '\nthis.panel = _pinKinPanelHtml;', sb);
  return sb.panel;
}
// The lines of a rendered panel, in order: label, whether it wears the tag, its edge colour, its tap.
function lines(html) {
  const out = [];
  const re = /<button type="button" onclick="([^"]*)" style="([^"]*)">([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(html))) {
    const lab = (m[3].match(/font-family:var\(--font-mono\)[^>]*>([^<]*)<\/span>/) || [])[1] || '';
    const edge = (m[2].match(/border:1px solid ([^;]+);/) || [])[1] || '';
    out.push({ label: lab, fits: /class="pin-kin-fits"/.test(m[3]), edge, tap: m[1] });
  }
  return out;
}
const hint = html => (html.match(/<div style="font-size:0\.68rem[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
const head = html => (html.match(/<div style="font-size:0\.76rem[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
const CATALOGUE_ORDER = ['6464-1', '6464-25', '6464-50', '6464-75', '6464-100', '6464-450', '6464-525'];

section('A. Brad\'s Great Northern: the two the read narrowed to lead, marked');
{
  const html = build()('6464', null, ['6464-25', '6464-450']);
  const L = lines(html);
  ok('the panel renders', !!html && L.length > 0, String(L.length));
  ok('the first two lines are 6464-25 and 6464-450', L.length >= 2 && L[0].label === '6464-25' && L[1].label === '6464-450', L.map(x => x.label).join(' '));
  ok('…both wear the tag, in the palette\'s green (var(--green) — no colour literal added; Brad: "no color should be hardcoded")', L.slice(0, 2).every(x => x.fits && x.edge === 'var(--green)'), JSON.stringify(L.slice(0, 2)));
  ok('…the tint is mixed from that green over the plain surface, which stays as the fallback', /background:var\(--surface2\);background:color-mix\(in srgb, var\(--green\) 10%, var\(--surface2\)\)/.test(html));
  ok('the rest follow in catalogue order, untagged, and the two lead lines are not repeated',
     L.slice(2).map(x => x.label).join(' ') === '6464-1 6464-50 6464-75 6464-100 6464-525' && L.slice(2).every(x => !x.fits),
     L.slice(2).map(x => x.label + (x.fits ? '*' : '')).join(' '));
  ok('every relative is still there — nothing was dropped to make room', L.length === CATALOGUE_ORDER.length, String(L.length));
  ok('the hint says what the green lines are: "The first two fit what was read from the photo."', /The first two fit what was read from the photo\./.test(hint(html)), hint(html));
  ok('…and the sub-number sentence still follows it', /The sub-number is on the box, not the car/.test(hint(html)), hint(html));
  ok('the head is unchanged', head(html) === 'The catalogue lists 6464 as these', head(html));
  ok('a lead line still picks its number on tap', L[0].tap === "_pinPickNum('6464-25')", L[0].tap);
  ok('the lead line came from the ITEM row, not the box row', /Great Northern Boxcar<\/span>/.test(html) && !/Great Northern Boxcar, 6/.test(html));
  ok('no "AI" anywhere in it', !/\bAI\b/.test(html));
}

section('B. No narrowing — the panel is exactly what it was');
{
  const plain = build()('6464', null, []);
  const P = lines(plain);
  ok('no alternatives: catalogue order, nothing tagged, no note', P.map(x => x.label).join(' ') === CATALOGUE_ORDER.join(' ') && P.every(x => !x.fits) && !/fit what was read/.test(plain), P.map(x => x.label).join(' '));
  const twoArg = build()('6464', null);
  ok('the old two-argument call still renders the same panel', twoArg === plain);
  const self = build()('6464', null, ['6464']);
  ok('a plain read of the number itself narrows nothing', self === plain);
  const lead = build()('6464', null, ['2300', '6440', '6427', '2340']);
  ok('another catalog\'s lead and the ambiguous windows narrow nothing', lead === plain);
  const typed = build()('6436', null, ['6464-25', '6464-450']);
  const T = lines(typed);
  ok('a number typed over the read: the 6464 relatives do not mark the 6436 family', T.map(x => x.label).join(' ') === '6436-1 6436-110' && T.every(x => !x.fits) && !/fit what was read/.test(typed), T.map(x => x.label).join(' '));
}

section('C. The edges');
{
  const chip = build()('6464', null, ['6464-25 (best guess)', '6464-25', '6464-450']);
  const C = lines(chip);
  ok('a chip-style label still counts, and a repeated member is listed once', C[0].label === '6464-25' && C[1].label === '6464-450' && C.filter(x => x.label === '6464-25').length === 1, C.map(x => x.label).join(' '));
  const era = build()('6464', null, ['6464-25', '6464-999']);
  const E = lines(era);
  ok('a relative outside the card\'s eras is neither marked nor counted', E[0].label === '6464-25' && E[0].fits && E.filter(x => x.fits).length === 1 && !E.some(x => x.label === '6464-999'), E.map(x => x.label + (x.fits ? '*' : '')).join(' '));
  ok('…so the note is singular: "The first one fits"', /The first one fits what was read from the photo\./.test(hint(era)), hint(era));
  ok('a dashed number typed in still gets no panel (the parent is not second-guessed)', build()('6464-25', null, ['6464-25', '6464-450']) === '');
  ok('a family with no rows in the card\'s eras still renders nothing', build()('9999', null, ['9999-1']) === '');
}

section('D. The plumbing: the card hands the read\'s alternatives to the panel');
{
  ok('the review card passes the ONE record it resolved (_rvAiRec.alts), as a third argument',
     /var _rdAlts = \(_rvAiRec && Array\.isArray\(_rvAiRec\.alts\)\) \? _rvAiRec\.alts : \[\];/.test(SRC) && /_pinKinPanelHtml\(lk\.num, lk\.master, _rdAlts\)/.test(SRC));
  ok('…and it is the only caller', (SRC.match(/_pinKinPanelHtml\(/g) || []).length === 2, String((SRC.match(/_pinKinPanelHtml\(/g) || []).length));   // the definition + the one caller
  ok('the lead lines and the rest are drawn by ONE line-maker', (grab(SRC, 'function _pinKinPanelHtml(num, matched, readAlts)').match(/var _kinLine = function \(k, fits\)/g) || []).length === 1);
}

section('E. THE OFFENDER: the panel that ignores the read, require red');
{
  const src = grab(SRC, 'function _pinKinPanelHtml(num, matched, readAlts)');
  const needle = '(Array.isArray(readAlts) ? readAlts : [])';
  ok('the offender hook is where the test expects it', src.indexOf(needle) > 0);
  const old = src.replace(needle, '[]');
  const html = build({ panelSource: old })('6464', null, ['6464-25', '6464-450']);
  const O = lines(html);
  ok('OFFENDER: with the read ignored, 6464-1 leads again and nothing is marked -> A red', O[0].label === '6464-1' && O.every(x => !x.fits) && !/fit what was read/.test(html), O.map(x => x.label).join(' '));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
