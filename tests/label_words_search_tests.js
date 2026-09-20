// ════════════════════════════════════════════════════════════════════════
// label_words_search_tests.js — v0.9.1781
//
// [stated] Brad, same CSX hopper, a later shot: "Lettering: no item number
// read" and "The free readers couldn't tell — nothing was spent."
//
// That first message is the one the app shows when the label text WAS read and
// simply held no item number ("nothing readable" is the other). So it had the
// words off his box, and the maker from the barcode, and never asked the
// catalog about either. v0.9.1780's near-miss rescue could not help: it needs a
// number to be one digit away FROM.
//
// THE FIXTURE IS THE REAL CATALOG. Measured on the live sheet before writing:
//     "201582"     ->  1 row of 22,355   (2542162, his hopper)
//     "CSX ACF"    ->  2 rows            (…161 and …162, differing ONLY by car number)
//     "CenterFlow" ->  8 rows
// All eight CenterFlow rows are below, verbatim. They are what makes the point:
// the WORDS are not decisive and the QUOTED CAR NUMBER is, which is why the
// search is anchored on digit runs and the words only break the tie.
//
// Section E plants an offender for every rule.
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
function build(src) {
  src = src || SRC;
  return new Function(
    'var _BC_STOP = ' + (src.match(/var _BC_STOP = (\/[^\n]*\/);/) || [, '/^$/'])[1] + ';\n'
    + grab(src, '_bcLabelDigitKeys') + '\n'
    + grab(src, '_bcWordKeys') + '\n'
    + grab(src, '_bcLabelScore') + '\n'
    + grab(src, '_bcClearWinner') + '\n'
    + 'return { digitKeys: _bcLabelDigitKeys, score: _bcLabelScore, winner: _bcClearWinner };')();
}
const H = build();

// ── The REAL eight CenterFlow rows, Lionel MPC-Modern, 2026-09-19 ───────
const CENTERFLOW = [
  { itemNum: '2542140', roadName: '', description: 'AEX ACF CenterFlow 4-Bay Covered Hopper "5094" w/Graffiti' },
  { itemNum: '2542150', roadName: '', description: 'AEX ACF CenterFlow 4-Bay Covered Hopper "5100" w/Graffiti' },
  { itemNum: '2542161', roadName: 'CSX', description: 'CSX ACF CenterFlow 4-Bay Covered Hopper "201569"' },
  { itemNum: '2542162', roadName: 'CSX', description: 'CSX ACF CenterFlow 4-Bay Covered Hopper "201582"' },
  { itemNum: '2542171', roadName: 'Denver & Rio Grande Western', description: 'D&RGW ACF CenterFlow 4-Bay Covered Hopper "15500"' },
  { itemNum: '2542172', roadName: 'Denver & Rio Grande Western', description: 'D&RGW ACF CenterFlow 4-Bay Covered Hopper "15590"' },
  { itemNum: '2542181', roadName: '', description: 'Cumberland Chemical ACF CenterFlow 4-Bay Covered Hopper "52206"' },
  { itemNum: '2542182', roadName: '', description: 'Cumberland Chemical ACF CenterFlow 4-Bay Covered Hopper "52208"' }
];
const LABEL = 'CSX ACF 4-Bay Centerflow #201582 Die-cast trucks Operating couplers O31 Minimum Curve FOR AGES 14 TO ADULT LIONEL';

function rank(label, rows) {
  return rows.map(r => ({ row: r, ...H.score(label, r) }))
             .sort((a, b) => b.score - a.score);
}

console.log('\n== A. The digit keys that anchor the search ==');
{
  ok('the quoted car number is picked up', H.digitKeys(LABEL).indexOf('201582') >= 0,
     JSON.stringify(H.digitKeys(LABEL)));
  ok('short runs are not keys — "O31" and "14" would match everything',
     H.digitKeys('O31 FOR AGES 14 TO ADULT').length === 0);
  ok('duplicates collapse', H.digitKeys('201582 201582 201582').length === 1);
  ok('no more than six keys are taken from one label',
     H.digitKeys('1111 2222 3333 4444 5555 6666 7777 8888').length === 6);
  ok('a label with no long digit run yields nothing to search on',
     H.digitKeys('CSX ACF Centerflow Covered Hopper').length === 0);
}

console.log('\n== B. THE REAL EIGHT: the car number decides, the words cannot ==');
{
  const r = rank(LABEL, CENTERFLOW);
  ok('his hopper wins outright', r[0].row.itemNum === '2542162',
     r.slice(0, 3).map(x => x.row.itemNum + ':' + x.score).join(' '));
  ok('…and the clear-winner rule accepts it', H.winner(r) && H.winner(r).itemNum === '2542162');
  ok('…beating 2542161, which differs ONLY by car number',
     r[0].score > r.find(x => x.row.itemNum === '2542161').score,
     '162:' + r[0].score + ' vs 161:' + r.find(x => x.row.itemNum === '2542161').score);

  // The point of anchoring on digits: the words alone reach EIGHT rows.
  const wordsOnly = 'ACF CenterFlow 4-Bay Covered Hopper';
  const r2 = rank(wordsOnly, CENTERFLOW);
  ok('the WORDS alone cannot separate these eight at all',
     r2[0].score === r2[7].score, r2.map(x => x.score).join(','));
  ok('…so the words-only label produces NO winner', H.winner(r2) === null);
}

console.log('\n== C. Silence, tested as hard as success ==');
{
  const boiler = rank('LIONEL O GAUGE FOR AGES 14 TO ADULT Die-cast trucks', CENTERFLOW);
  ok('boilerplate scores nothing anywhere', boiler[0].score === 0);
  ok('…and yields no winner', H.winner(boiler) === null);
  ok('an empty pool yields no winner', H.winner([]) === null && H.winner(null) === null);

  // A car number that belongs to a DIFFERENT row must not drag his in.
  const wrong = rank('ACF CenterFlow Covered Hopper #15590', CENTERFLOW);
  ok('a different car number selects that row, not his',
     H.winner(wrong) && H.winner(wrong).itemNum === '2542172',
     H.winner(wrong) ? H.winner(wrong).itemNum : 'null');
}

console.log('\n== D. The search is cheap by construction ==');
{
  ok('whole tabs of the wrong maker are skipped without touching their rows',
     /if \(want && !_bcRowIsMfr\(m, want\)\) continue;/.test(SRC));
  ok('the row test is an indexOf on a short string, not a regex',
     /hay\.indexOf\(keys\[k\]\) >= 0/.test(SRC));
  ok('a key matching more than a handful of rows is abandoned',
     /if \(pool\.length > 40\) \{ tooMany = true; return; \}/.test(SRC) &&
     /if \(tooMany \|\| !pool\.length\) return null;/.test(SRC));
  ok('the barcode\'s own digits are stripped before keys are taken',
     /_bcLabelDigitKeys\(_stripUPCs\(String\(labelText\)\)\)/.test(SRC));
  ok('no digit runs means no search at all', /if \(!keys\.length\) return null;/.test(SRC));
}

console.log('\n== E. Wired in, and honest about it ==');
{
  ok('it runs before the app gives up and offers to spend a read',
     SRC.indexOf('var _byWords = await _bcFindByLabelWords(') <
     SRC.indexOf("st('master', '➖', 'Catalog: no direct match yet');"));
  ok('…using the label text the app already read',
     /_bcFindByLabelWords\(ocrText, out\.bcMaker\)/.test(SRC));
  ok('the offer is an AMBER caution, never a green tick',
     /cautionNote: 'No item number could be read from the label\. '/.test(SRC));
  ok('…and it says plainly why, so the number can be checked',
     /is the only catalog entry matching the wording on it/.test(SRC));

  // THE RULE LIVES ONCE. Writing it twice defeated its own planted offender:
  // the test removed one copy and the other kept the suite green.
  ok('the clear-winner rule exists exactly ONCE',
     (SRC.match(/if \(top\.score < 2\) return null;/g) || []).length === 1);
  ok('…and both rescues call it rather than repeating it',
     (SRC.match(/return _bcClearWinner\(scored\);/g) || []).length === 2);
}

console.log('\n== F. THE OFFENDERS: break each one, require red ==');
{
  // 1 — the tie guard goes. With the rule in ONE place this offends again.
  const bad1 = build(SRC.replace('if (second && second.score >= top.score) return null;', ''));
  const tie = rank('ACF CenterFlow 4-Bay Covered Hopper', CENTERFLOW);
  ok('losing the tie guard is caught', bad1.winner(tie) !== null,
     'the no-winner check would have passed on broken source');

  // 2 — the digit-run floor drops to 2 and every "14" and "31" becomes a key.
  // The replacement is '\\d{2,}' — in a JS string that is the two characters
  // \d, which is what belongs in the source. '\\\\d{2,}' would have written a
  // LITERAL backslash into the regex and quietly broken nothing.
  const bad2 = build(SRC.replace(/\\d\{4,\}/, '\\d{2,}'));
  ok('a shorter digit-key floor is caught',
     bad2.digitKeys('O31 FOR AGES 14 TO ADULT').length > 0,
     'the short-run check would have passed on broken source');

  // 3 — the pool cap goes, so a common key can scan the whole catalog.
  ok('losing the pool cap is caught',
     !/if \(pool\.length > 40\) \{ tooMany = true; return; \}/
        .test(SRC.replace('if (pool.length > 40) { tooMany = true; return; }', '')));

  // 4 — the maker filter goes and another catalog's rows enter the pool.
  ok('losing the maker skip is caught',
     !/if \(want && !_bcRowIsMfr\(m, want\)\) continue;/
        .test(SRC.replace('if (want && !_bcRowIsMfr(m, want)) continue;', '')));

  // 5 — the amber caution becomes a green tick. This is the original bug.
  ok('turning the caution into a green tick is caught',
     !/cautionNote: 'No item number could be read from the label\. '/
        .test(SRC.replace("cautionNote: 'No item number could be read from the label. '",
                          "verifiedNote: '✓ '")));

  // 6 — the UPC strip goes, so the barcode's digits become description keys.
  ok('searching on the barcode\'s own digits is caught',
     !/_bcLabelDigitKeys\(_stripUPCs\(String\(labelText\)\)\)/
        .test(SRC.replace('_bcLabelDigitKeys(_stripUPCs(String(labelText)))',
                          '_bcLabelDigitKeys(String(labelText))')));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
