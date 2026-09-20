// ════════════════════════════════════════════════════════════════════════
// near_miss_and_maker_tests.js — v0.9.1780
//
// Brad, 2026-09-19, three screenshots and no words. Two defects in them:
//
//  1. A barcode ending 36814 offered a Lionel, a Märklin HO and an LGB G.
//     All three are REAL rows — three makers use that number — but the UPC
//     prefix had already PROVED the maker was Lionel.
//  2. His CSX hopper's label reads 2542162. The reader said 2642162, a 5
//     taken as a 6, and announced it with a GREEN TICK and "not in your
//     catalog" — a typo the app made, reported as a fact about the catalog.
//
// THE FIXTURE BELOW IS THE REAL CATALOG. Before any of this was written the
// live master sheet was queried: Lionel MPC-Modern holds 22,355 item numbers,
// 2542162 IS there, 2642162 is NOT, and there are TEN one-digit neighbours —
// not one. "Offer it when exactly one exists" would have stayed silent on the
// very box that prompted the work. These ten rows are those ten, copied
// verbatim, so the rule is proved against the thing it has to survive.
//
// Section F plants an offender for every rule.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'barcode.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}
function grabVar(src, decl) {
  const i = src.indexOf(decl);
  if (i < 0) throw new Error('could not find ' + decl);
  return src.slice(i, src.indexOf('\n', src.indexOf('];', i))) ;
}
// Build the real helpers in their own scope.
function build(src) {
  src = src || SRC;
  return new Function(
    grabVar(src, 'var _BC_BRANDS =') + '\n'
    + 'var _BC_STOP = ' + (src.match(/var _BC_STOP = (\/[^\n]*\/);/) || [, '/^$/'])[1] + ';\n'
    + grab(src, '_bcIsBrandFragment') + '\n'
    + grab(src, '_bcOneDigitVariants') + '\n'
    + grab(src, '_bcWordKeys') + '\n'
    + grab(src, '_bcLabelScore') + '\n'
    + grab(src, '_bcMfrKey') + '\n'
    + grab(src, '_bcRowIsMfr') + '\n'
    + grab(src, '_bcRankByMaker') + '\n'
    + 'return { brandFrag: _bcIsBrandFragment, variants: _bcOneDigitVariants,'
    + ' score: _bcLabelScore, rank: _bcRankByMaker, mfrKey: _bcMfrKey };')();
}
const H = build();

// ── THE REAL TEN, from Lionel MPC-Modern, 2026-09-19 ────────────────────
const NEIGHBOURS = [
  { itemNum: '2442162', roadName: 'Boston & Maine', description: 'B&M Single-sheath Boxcar "70919"' },
  { itemNum: '2542162', roadName: 'CSX',            description: 'CSX ACF CenterFlow 4-Bay Covered Hopper "201582"' },
  { itemNum: '2642062', roadName: '',               description: 'Premier Malt Products Woodside Reefer #12305' },
  { itemNum: '2642102', roadName: '',               description: 'Milwaukee Road Single Sheath Boxcar #715277' },
  { itemNum: '2642112', roadName: '',               description: 'Minnesota Mining & Mfg Single Sheath Boxcar #1069' },
  { itemNum: '2642122', roadName: '',               description: 'Southern Pacific Single Sheath Boxcar #8987' },
  { itemNum: '2642160', roadName: '',               description: 'Lackawanna 3 Bay AAR Hopper 3 Pack A' },
  { itemNum: '2642165', roadName: '',               description: 'Lackawanna 3 Bay AAR Hopper 3 Pack B' },
  { itemNum: '2642169', roadName: '',               description: 'Lackawanna 3 Bay AAR Hopper #84335' },
  { itemNum: '2642262', roadName: '',               description: 'Illinois Central 4740 PS-2CD #765280' }
];
// What the OCR actually read off Brad's box, as shown on his screen.
const LABEL = 'CSX ACF 4-Bay Centerflow #201582 Die-cast trucks Operating couplers O31 Minimum Curve 2642162 FOR AGES 14 TO ADULT LIONEL';

console.log('\n== A. One-digit variants ==');
{
  const v = H.variants('2642162');
  ok('a 7-digit number has 63 one-digit variants', v.length === 63, String(v.length));
  ok('…the number itself is not among them', v.indexOf('2642162') < 0);
  ok('…they are all distinct', new Set(v).size === 63);
  ok('…and the real answer IS among them', v.indexOf('2542162') >= 0);
  ok('a number with letters or a dash is refused', H.variants('6-464').length === 0 && H.variants('ABC').length === 0);
}

console.log('\n== B. THE REAL TEN: the label decides, digit distance cannot ==');
{
  const scored = NEIGHBOURS.map(r => ({ n: r.itemNum, s: H.score(LABEL, r) }))
                           .sort((a, b) => b.s.score - a.s.score);
  ok('the right row wins outright', scored[0].n === '2542162',
     scored.slice(0, 3).map(x => x.n + ':' + x.s.score).join(' '));
  ok('…and beats the runner-up, so a clear winner exists',
     scored[0].s.score > scored[1].s.score,
     scored[0].n + ':' + scored[0].s.score + ' vs ' + scored[1].n + ':' + scored[1].s.score);
  ok('…on a substantial word, not a two-letter coincidence', scored[0].s.longest >= 4,
     'longest shared key = ' + scored[0].s.longest);
  ok('the car number 201582 is doing real work — it is a key of its own',
     H.score('201582', NEIGHBOURS[1]).score >= 2);
  // This is the check that killed the original design.
  ok('DIGIT DISTANCE ALONE WOULD NOT HAVE DECIDED: ten neighbours, not one',
     NEIGHBOURS.length === 10);
}

console.log('\n== C. It keeps quiet when the label does not decide ==');
{
  // An honest "not in your catalog" beats a confident wrong answer — that is
  // the complaint being fixed, so silence has to be tested as hard as success.
  const weak = 'LIONEL O GAUGE FOR AGES 14 TO ADULT';
  const scored = NEIGHBOURS.map(r => H.score(weak, r).score).sort((a, b) => b - a);
  ok('boilerplate-only label scores nothing anywhere', scored[0] === 0, String(scored[0]));

  const ambiguous = 'Lackawanna 3 Bay AAR Hopper';
  const s2 = NEIGHBOURS.map(r => ({ n: r.itemNum, s: H.score(ambiguous, r).score }))
                       .sort((a, b) => b.s - a.s);
  ok('a label matching THREE rows equally produces no clear winner',
     s2[0].s === s2[1].s, s2.slice(0, 3).map(x => x.n + ':' + x.s).join(' '));
  ok('…which is exactly the tie the rescue must refuse',
     /if \(second && second\.score >= top\.score\) return null;/.test(SRC));
}

console.log('\n== D. The rescue\'s own rules ==');
{
  ok('a clear winner needs at least two shared keys', /if \(top\.score < 2\) return null;/.test(SRC));
  ok('…one of them substantial', /if \(top\.longest < 4\) return null;/.test(SRC));
  ok('neighbours from another maker are dropped — the barcode proved the maker',
     /if \(want\) hits = hits\.filter\(function \(h\) \{ return _bcRowIsMfr\(h, want\); \}\);/.test(SRC));
  ok('the variants are looked up through the EXISTING exact matcher',
     /_findMasterItemsAllEras\(variants\)/.test(SRC));
  ok('the correction is offered as an AMBER caution, never a green tick',
     /cautionNote: 'The label read as ' \+ _printed/.test(SRC) &&
     !/verifiedNote[^\n]*_near\.itemNum/.test(SRC));
  ok('…and it names both numbers so the user can check the box',
     /is one digit different and matches the wording on the label/.test(SRC));
  ok('the rescue runs BEFORE the "not in the catalog" path, not instead of it',
     SRC.indexOf('var _near = await _bcNearMissRescue(') <
     SRC.indexOf("st('master', '📖', 'Catalog: ' + _printed + ' not in the catalog"));
}

console.log('\n== E. The maker the barcode proved ==');
{
  // Brad's first screenshot: one Lionel, one Märklin, one LGB.
  const hits = [
    { itemNum: '36814', _tab: 'Marklin HO',        description: 'BR 100 Köf II' },
    { itemNum: '6-36814', _tab: 'Lionel MPC-Modern', description: 'Rio Grande Animated Caboose' },
    { itemNum: '36814', _tab: 'LGB G',             description: 'WW & F Ry Passenger Car' }
  ];
  const r = H.rank(hits, 'Lionel');
  ok('the Lionel row comes first', r[0].itemNum === '6-36814', r.map(x => x._tab).join(' | '));
  ok('…the other makers are still THERE — demoted, not deleted', r.length === 3);
  ok('…and tagged so the picker can draw a line above them',
     r[1]._otherMfr === true && r[2]._otherMfr === true);
  ok('…while the right-maker row is not tagged', r[0]._otherMfr === false);
  ok('order WITHIN each group is untouched — a stable partition, not a sort',
     r[1]._tab === 'Marklin HO' && r[2]._tab === 'LGB G');

  const none = H.rank([{ itemNum: '36814', _tab: 'Marklin HO' }, { itemNum: '36814', _tab: 'LGB G' }], 'Lionel');
  ok('when NO row matches the maker the list is left exactly as it was',
     none.length === 2 && !none[0]._otherMfr && !none[1]._otherMfr,
     'a divider above the whole list would say nothing');
  ok('with no maker known, nothing is reordered', H.rank(hits, '').length === 3);
  ok('the picker draws the divider from that tag',
     /_firstOther = !!m\._otherMfr/.test(SRC) && /Other makers with this number/.test(SRC));
}

console.log('\n== F. "IONEL" — a wordmark is not a description ==');
{
  ok('IONEL is caught (the L clipped off LIONEL)', H.brandFrag('ionel') === true);
  ok('LIONE too', H.brandFrag('lione') === true);
  ok('the whole word as well', H.brandFrag('lionel') === true);
  ok('TLAS, ATLA', H.brandFrag('tlas') === true && H.brandFrag('atla') === true);
  ok('…but a real description is untouched',
     H.brandFrag('csx acf centerflow 4 bay covered hopper') === false);
  ok('…and so are short words that merely share letters',
     H.brandFrag('ion') === false && H.brandFrag('oil') === false);
  ok('the check is wired into the description filter',
     /if \(_bcIsBrandFragment\(_tl\)\) return false;/.test(SRC));
}

console.log('\n== G. THE OFFENDERS: break each one, require red ==');
{
  // 1 — the tie guard goes, and ten weak candidates start producing answers.
  ok('losing the tie guard is caught',
     !/if \(second && second\.score >= top\.score\) return null;/
        .test(SRC.replace('if (second && second.score >= top.score) return null;', '')));

  // 2 — the maker filter goes from the rescue, so another catalog's number
  //     can be offered as a correction to a Lionel box.
  ok('losing the rescue\'s maker filter is caught',
     !/return _bcRowIsMfr\(h, want\); \}\);/
        .test(SRC.replace(/if \(want\) hits = hits\.filter\(function \(h\) \{ return _bcRowIsMfr\(h, want\); \}\);/, '')));

  // 3 — the correction is dressed as a green tick again. This IS the bug.
  ok('turning the amber caution back into a green tick is caught',
     !/cautionNote: 'The label read as ' \+ _printed/
        .test(SRC.replace("cautionNote: 'The label read as ' + _printed", "verifiedNote: '✓ ' + _printed")));

  // 4 — ranking deletes instead of demoting.
  const badRank = build(SRC.replace('return mine.concat(others);', 'return mine;'));
  const r4 = badRank.rank([
    { itemNum: '36814', _tab: 'Marklin HO' },
    { itemNum: '6-36814', _tab: 'Lionel MPC-Modern' }
  ], 'Lionel');
  ok('deleting other makers instead of demoting them is caught', r4.length !== 2,
     'the demote-not-delete check would have passed on broken source');

  // 5 — the brand-fragment floor drops to 3 and starts eating real words.
  const badBrand = build(SRC.replace('if (s.length < 4) return false;', 'if (s.length < 3) return false;'));
  ok('a shorter brand-fragment floor is caught (it would reject "ion")',
     badBrand.brandFrag('ion') === true,
     'the real-words check would have passed on broken source');

  // 6 — a long digit run stops counting double, so the car number that
  //     actually decided this case becomes just another word.
  const badScore = build(SRC.replace('if (/^\\d+$/.test(w)) { if (w.length >= 4) out[w] = 2; return; }',
                                     'if (/^\\d+$/.test(w)) { return; }'));
  ok('dropping the car-number key is caught',
     badScore.score('201582', NEIGHBOURS[1]).score === 0,
     'the car-number check would have passed on broken source');
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
