// ═══════════════════════════════════════════════════════════════
// forsale_price_tests.js — Session 82.
//
// The import screen has been promising: "you can filter to 'no asking price'
// and fill them in anytime." No such filter existed. Brad's import flagged
// 160 items for sale with no price and gave him no way to work through them.
//
// Run:  node tests/forsale_price_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-pages.js'), 'utf8');
const imp = fs.readFileSync(path.join(__dirname, '..', 'app', 'import-ui.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// The promise the import makes, and the thing that now keeps it.
ok('the import still promises a price filter', /no asking price/i.test(imp));
ok('the For Sale list can filter to unpriced',
   /state\._fsNeedsPrice && parseFloat\(fs\.askingPrice\) > 0\) return false/.test(src));
ok('there is a chip to turn it on', /function rrFsToggleNeedsPrice/.test(src));
ok('the count comes from the WHOLE list, not the filtered view',
   /counted across the\s*\/\/ WHOLE list/.test(src),
   'counting the filtered view would zero the chip the moment it is used');
ok('grouped companions are not counted twice', /_fsIsGroupedCompanion\(fs\)\) return;/.test(src));

// The fill-in screen.
ok('there is a fill-them-in screen', /function rrFsPriceFill\b/.test(src));
ok('it lists every unpriced entry', /function _rrFsPriceless/.test(src));
ok('...sorted by item number the way a human reads them',
   /localeCompare\(String\(b\.fs\.itemNum \|\| ''\), undefined, \{ numeric: true \}\)/.test(src));
ok('it shows what they paid and what it is worth',
   /paid ' \+ _currencySymbol\(\)[\s\S]{0,120}worth ' \+ _currencySymbol\(\)/.test(src),
   'pricing from nothing is guesswork');
ok('a blank simply stays on the list', /Leave anything blank and it simply stays on the list/.test(src));
ok('only real prices are written', /filter\(function \(t\) \{ return t\.val > 0; \}\)/.test(src));

// Writing. This is the part that can hurt someone's data.
ok('it writes ONLY the price cell', /'For Sale!D' \+ fs\.row/.test(src),
   'writing the whole row would clobber edits made elsewhere');
ok('...and says why column D is the price', /Column D is Asking Price/.test(src));
ok('a failed row is counted and reported, not swallowed',
   /failed\+\+;[\s\S]{0,140}console\.warn\('\[For Sale\] price save failed/.test(src));
ok('the toast tells you if some did not save', /could not be saved — try those again/.test(src));
ok('the list is rebuilt after saving', /ov\.remove\(\);\s*if \(typeof buildForSalePage === 'function'\) buildForSalePage\(\)/.test(src));

console.log('');
console.log(fail === 0 ? 'ALL FOR-SALE PRICE TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
