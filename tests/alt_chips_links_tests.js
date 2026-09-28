// ════════════════════════════════════════════════════════════════════════
// alt_chips_links_tests.js — v0.9.1833
//
// EACH CHOICE SAYS WHAT IT IS AND LINKS TO ITS PAGE; NO "USE THIS" WHEN
// THERE ARE CHOICES.
//
// [stated] Brad, phone, 2026-09-28, after picking 6464-25 from the two the
// reader had narrowed his Great Northern to: "yes, it worked. but if you
// don't know, from this screen you still don't know what to pick. need to
// include the link for each underneath the number so you can pick. Also
// don't need the 6464- use this as it add to the confusion when you have 2
// to pick from."
//
// These tests run the REAL _pinAltList / _pinAltChips / _pinCardRowFor
// (brace-matched out of photo-inbox.js) over rows shaped like his catalog.
// Section G plants the old chips — bare numbers, no description, no link —
// and the old guess-chip rule, and requires red.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

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

// Rows shaped like Brad's catalog (the 6464 pair as measured 2026-09-28; the
// three windows his v1831 scan glued together; one BOX row that must never
// speak for its car; one relative from another era).
const row = (num, era, road, desc, link, extra) => Object.assign({ itemNum: num, _era: era, roadName: road, description: desc, _tab: 'Lionel PW - Items', refLink: link }, extra || {});
const ROWS = [
  row('6464-25',  'pw', '', 'Great Northern Boxcar, 6', '', { _tab: 'Lionel PW - Boxes', _box: true }),   // the BOX, listed first on purpose
  row('6464-25',  'pw', 'Great Northern', 'Great Northern Boxcar', 'https://cott.test/6464-25'),
  row('6464-450', 'pw', 'Great Northern', 'Great Northern Boxcar', 'https://cott.test/6464-450'),
  row('6440',     'pw', '', 'Flatcar with Vans', 'https://cott.test/6440'),
  row('6427',     'pw', 'Lionel Lines', 'Lionel Lines N5c Porthole Caboose', 'https://cott.test/6427'),
  row('2340',     'pw', 'Pennsylvania', 'GG-1 Electric', ''),                                   // a row with no reference link
  row('2300',     'mpc', '', 'Operating Oil Drum Loader', 'https://cott.test/2300'),           // another era: invisible to a Postwar card
];

function build(opts) {
  opts = opts || {};
  const sb = {
    console,
    window: { rrDemotedRow: r => !!(r && r._box) },
    _rvAiRec: opts.rec === undefined ? null : opts.rec,
    _pinKinRowsFor: n => ROWS.filter(r => r.itemNum === String(n).trim()),
    _prefEras: p => (p && p.era) ? [p.era] : [],
    _rvPrefer: () => ({ era: opts.era || 'pw' }),
    rrEsc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
  };
  vm.createContext(sb);
  vm.runInContext(grab(SRC, 'function _pinCardRowFor(n)') + '\n' + (opts.listSource || grab(SRC, 'function _pinAltList()')) + '\n' + grab(SRC, 'function _pinAltChips()')
    + '\nthis.list = _pinAltList; this.chips = _pinAltChips; this.rowFor = _pinCardRowFor;', sb);
  return sb;
}
// The choices of a rendered chip block, in order.
function choices(html) {
  const out = [];
  const re = /<div class="pin-alt"[^>]*>([\s\S]*?)<\/div>(?=<div class="pin-alt"|<\/div><\/div>$)/g;
  let m;
  while ((m = re.exec(html))) {
    const b = m[1];
    out.push({
      label: ((b.match(/<button type="button" onclick="_pinPickNum\('[^']*'\)"[^>]*>([^<]*)<\/button>/) || [])[1] || '').replace(/^\u2605 /, '').trim(),
      tap: (b.match(/onclick="(_pinPickNum\('[^']*'\))"/) || [])[1] || '',
      desc: (b.match(/class="pin-alt-desc"[^>]*>([^<]*)<\/div>/) || [])[1] || '',
      link: (b.match(/class="pin-alt-view" onclick="window\.open\('([^']*)'/) || [])[1] || '',
      hot: /★ /.test(b),
    });
  }
  return out;
}
const hint = html => (html.match(/<div style="font-size:0\.72rem[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
const GN = { num: '6464', guess: 1, alts: ['6464-25', '6464-450'] };

section('A. Brad\'s Great Northern: two choices, each with its description and its page');
{
  const b = build({ rec: GN });
  const html = b.chips();
  const C = choices(html);
  ok('two choices, 6464-25 then 6464-450', C.length === 2 && C[0].label === '6464-25' && C[1].label === '6464-450', JSON.stringify(C.map(c => c.label)));
  ok('each says what it is', C.every(c => c.desc === 'Great Northern Boxcar'), JSON.stringify(C.map(c => c.desc)));
  ok('each links to ITS reference page — the item row\'s, not the box row\'s', C[0].link === 'https://cott.test/6464-25' && C[1].link === 'https://cott.test/6464-450', JSON.stringify(C.map(c => c.link)));
  ok('…opened in a new tab, no opener', /window\.open\('https:\/\/cott\.test\/6464-25','_blank','noopener'\)/.test(html));
  ok('tapping the number still fills it in', C[0].tap === "_pinPickNum('6464-25')" && C[1].tap === "_pinPickNum('6464-450')", JSON.stringify(C.map(c => c.tap)));
  ok('neither wears a star (the read was the family, not one of them) and the hint does not mention one', C.every(c => !c.hot) && !/best guess/.test(hint(html)), hint(html));
  ok('the hint says what to do: view each, then tap the one you have', /view each to compare, then tap the one you have/.test(hint(html)), hint(html));
  ok('the bare 6464 is not offered as a choice (no such row; the chips cover it)', !C.some(c => c.label.indexOf('6464 ') === 0 || c.label === '6464'));
  ok('the description and the page sit UNDER the number (one column per choice)', /<div class="pin-alt" style="display:flex;flex-direction:column/.test(html));
  ok('no "AI" anywhere in it', !/\bAI\b/.test(html));
  ok('the link is the palette\'s blue (var(--want)) — no colour literal added', /color:var\(--want\)/.test(html) && !/pin-alt-view[^>]*#2980b9/.test(html));
}

section('B. Three glued windows (v1831\'s 6440 / 6427 / 2340): the star, the descriptions, a row with no page');
{
  const b = build({ rec: { num: '6440', guess: 1, alts: ['6440', '6427', '2340'] } });
  const html = b.chips();
  const C = choices(html);
  ok('three choices in the reader\'s order', C.map(c => c.label).join(' ') === '6440 6427 2340', C.map(c => c.label).join(' '));
  ok('the best guess wears the star, and only it', C[0].hot && !C[1].hot && !C[2].hot);
  ok('…so the hint explains the star', /\(★ = best guess\)/.test(hint(html)), hint(html));
  ok('the descriptions tell the three apart', C[0].desc === 'Flatcar with Vans' && /Caboose/.test(C[1].desc) && /GG-1/.test(C[2].desc), JSON.stringify(C.map(c => c.desc)));
  ok('a row with no reference link gets no "view" — nothing is invented', C[2].link === '' && !/window\.open\(''/.test(html) && (html.match(/class="pin-alt-view"/g) || []).length === 2);
}

section('C. Choices with no row at all, a guess outside its own list, repeats');
{
  const b = build({ rec: { num: '9999', guess: 1, alts: ['9998', '9997'] } });
  const html = b.chips();
  const C = choices(html);
  ok('a guess that is not among the alternatives is added first as "(best guess)", starred', C.length === 3 && C[0].label === '9999 (best guess)' && C[0].hot, JSON.stringify(C.map(c => c.label)));
  ok('numbers with no catalogue row are still offered — bare, no description, no page', C.slice(1).every(c => c.desc === '' && c.link === '') && C[1].tap === "_pinPickNum('9998')");
  const d = build({ rec: { num: '6464', guess: 1, alts: ['6464-25', '6464-25', '6464-450'] } });
  ok('the same number twice is one choice', choices(d.chips()).map(c => c.label).join(' ') === '6464-25 6464-450');
  const e = build({ rec: { num: '6464', guess: 1, alts: ['2300'] } });
  const E = choices(e.chips());
  ok('a choice from another era shows no description or page on a Postwar card (its row is not this card\'s)', E.length === 2 && E[1].label === '2300' && E[1].desc === '' && E[1].link === '', JSON.stringify(E));
  ok('no alternatives → no chips at all', build({ rec: { num: '6464', guess: 1, alts: [] } }).chips() === '' && build({ rec: null }).chips() === '');
}

section('D. The shared row-picker: one answer for the chips AND the family panel');
{
  const b = build({ rec: null });
  const r = b.rowFor('6464-25');
  ok('the item row beats the box row even when the box is listed first', r && r.roadName === 'Great Northern' && !r._box, JSON.stringify(r));
  ok('a number with rows only in another era gives nothing on this card', b.rowFor('2300') === null);
  const mpc = build({ rec: null, era: 'mpc' });
  ok('…and gives that row on a card of that era', !!mpc.rowFor('2300') && mpc.rowFor('2300').description === 'Operating Oil Drum Loader');
  ok('a demoted row is still returned when it is all there is (the panel\'s old fallback, kept)', (function () {
    const sb = build({ rec: null });
    sb._pinKinRowsFor = n => (String(n) === 'B1') ? [row('B1', 'pw', '', 'A box only', 'https://cott.test/B1', { _tab: 'Lionel PW - Boxes', _box: true })] : [];
    return !!sb.rowFor('B1') && sb.rowFor('B1')._box === true;
  })());
  ok('the family panel\'s lines ask the same picker', /var r0 = _pinCardRowFor\(k\);/.test(grab(SRC, 'function _pinKinPanelHtml(num, matched, readAlts)')));
  ok('…and it is defined once', (SRC.match(/function _pinCardRowFor\(n\)/g) || []).length === 1);
}

section('E. "6464 — use this" only when there is nothing to pick between');
{
  const g = SRC.slice(SRC.indexOf('var _guessChip = '), SRC.indexOf('var _guessChip = ') + 120);
  ok('the guess chip is gated on the SAME list the chips draw (fewer than two choices)', /var _guessChip = \(sugGuess && _pinAltList\(\)\.length < 2\)/.test(g), g);
  ok('two choices → no guess chip (Brad\'s case)', build({ rec: GN }).list().length === 2);
  ok('one choice that IS the guess → the chip stays (the one way to take it)', build({ rec: { num: '6440', guess: 1, alts: ['6440'] } }).list().length === 1);
  ok('no alternatives → the chip stays', build({ rec: { num: '6440', guess: 1, alts: [] } }).list().length === 0);
  ok('the record is the ONE the card resolved (_rvAiRec), not a second lookup', /try \{ s = _rvAiRec \|\| \{\}; \}/.test(grab(SRC, 'function _pinAltList()')) && !/_ids\(\)/.test(grab(SRC, 'function _pinAltList()')));
  ok('the "Best guess from the photo" chip itself is unchanged (the v1103 pins still hold)', /Best guess from the photo:/.test(SRC) && /use this<\/button>/.test(SRC));
}

section('F. Both card layouts draw the chips from the one function');
{
  ok('the stacked card and the two-column card both call _pinAltChips() (the definition + two callers)', (SRC.match(/_pinAltChips\(\)/g) || []).length === 3 && /_pinAltChips\(\) \+/.test(SRC) && /_chips = _pinAltChips\(\);/.test(SRC), String((SRC.match(/_pinAltChips\(\)/g) || []).length));
  ok('_pinAltChips is defined once and only draws — the list lives in _pinAltList', (SRC.match(/function _pinAltChips\(\)/g) || []).length === 1 && /var list = _pinAltList\(\);/.test(grab(SRC, 'function _pinAltChips()')));
}

section('G. THE OFFENDERS, require red');
{
  // 1. the old chips: a bare number, no row asked → no description, no page
  const src = grab(SRC, 'function _pinAltList()');
  const needle = 'var row = n ? _pinCardRowFor(n) : null;';
  ok('the offender hook is where the test expects it', src.indexOf(needle) > 0);
  const old = src.replace(needle, 'var row = null;');
  const C = choices(build({ rec: GN, listSource: old }).chips());
  ok('OFFENDER 1: chips that never ask the catalogue have no description and no page -> A red', C.length === 2 && C.every(c => c.desc === '' && c.link === ''), JSON.stringify(C));
  // 2. the old guess-chip rule, always shown
  ok('OFFENDER 2: the old rule (`var _guessChip = sugGuess`) fails the E pin', !/var _guessChip = \(sugGuess && _pinAltList\(\)\.length < 2\)/.test('    var _guessChip = sugGuess\n      ? \'<div'));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
